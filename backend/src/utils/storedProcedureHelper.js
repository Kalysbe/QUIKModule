// utils/storedProcedureHelper.js
// Универсальный хелпер для выполнения хранимых процедур
import { getMssqlPool, sql } from "../config/dbMssql.js";

export function detectSpFailure(result, infoObjects) {
    const infoMessages = (infoObjects || []).map(i => i.message ?? "");
    const matchesErrText = (s) =>
        /unable|error|ошибк|does not exist|not found|already exists|duplicate|invalid|constraint|violat/i.test(s || "");

    const infoLooksLikeError = infoMessages.some(matchesErrText);
    const recordsetHasFailureFlag =
        Array.isArray(result.recordset) &&
        result.recordset.length > 0 &&
        (result.recordset[0]?.Success === false ||
            matchesErrText(JSON.stringify(result.recordset[0] || {})));
    const outputLooksLikeError =
        result.output &&
        Object.values(result.output).some((v) => matchesErrText(String(v)));
    const nonZeroReturn =
        typeof result.returnValue === "number" && result.returnValue !== 0;

    const spFailed = nonZeroReturn || infoLooksLikeError || recordsetHasFailureFlag || outputLooksLikeError;

    let reason =
        infoMessages.find(matchesErrText) ||
        (recordsetHasFailureFlag ? "Stored procedure reported failure via recordset" : null) ||
        (outputLooksLikeError ? "Stored procedure reported failure via output params" : null) ||
        (nonZeroReturn ? `Stored procedure returned non-zero code: ${result.returnValue}` : null) ||
        "Business error from stored procedure";

    return { spFailed, reason, infoMessages };
}

export function normalizeNullables(data, nullableKeys = []) {
    const out = { ...data };
    for (const k of nullableKeys) {
        if (out[k] === "" || out[k] === undefined) out[k] = null;
    }
    return out;
}

// Универсальная функция для выполнения хранимой процедуры
export async function executeStoredProcedure(
    procedureName,
    data,
    typeMap,
    nullableKeys = [],
    res,
    next,
    successMessage = "Операция выполнена успешно"
) {
    try {
        const normalizedData = normalizeNullables(data, nullableKeys);
        const pool = await getMssqlPool();
        const request = pool.request();
        const infoObjects = [];

        request.on("info", (info) => {
            infoObjects.push({
                message: info?.message ?? "",
                number: info?.number,
                state: info?.state,
                class: info?.class,
                procName: info?.procName,
                lineNumber: info?.lineNumber,
            });
        });

        // Добавляем параметры
        for (const [key, value] of Object.entries(normalizedData)) {
            const sqlType = typeMap[key] ?? sql.NVarChar;
            request.input(key, sqlType, value ?? null);
        }

        const result = await request.execute(procedureName);
        const { spFailed, reason, infoMessages } = detectSpFailure(result, infoObjects);

        if (spFailed) {
            return res.status(409).json({
                success: false,
                message: `Процедура ${procedureName} вернула ошибку`,
                reason,
                returnValue: result.returnValue ?? null,
                output: result.output ?? {},
                info: infoObjects,
                recordset: result.recordset ?? [],
            });
        }

        return res.status(200).json({
            success: true,
            message: successMessage,
            resultset: result.recordset ?? [],
            rowsAffected: result.rowsAffected,
            output: result.output ?? {},
            returnValue: result.returnValue ?? null,
            info: infoMessages,
        });
    } catch (error) {
        const isMssqlError =
            error?.name === "RequestError" ||
            error?.code === "EREQUEST" ||
            error?.originalError;

        if (isMssqlError) {
            const sqlInfo = {
                message: error.originalError?.message || error.message,
                number: error.originalError?.number,
                state: error.originalError?.state,
                class: error.originalError?.class,
                lineNumber: error.originalError?.lineNumber,
                serverName: error.originalError?.serverName,
                procName: error.originalError?.procName,
                precedingErrors: error.precedingErrors?.map((e) => e.message),
            };

            return res.status(500).json({
                success: false,
                message: `Ошибка при выполнении процедуры ${procedureName}`,
                sql: sqlInfo,
            });
        }

        return next(error);
    }
}

// Универсальная функция для валидации и выполнения
export function createStoredProcedureHandler(
    schema,
    procedureName,
    typeMap,
    nullableKeys = [],
    successMessage = "Операция выполнена успешно"
) {
    return async (req, res, next) => {
        try {
            const parsed = schema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    message: "Ошибка валидации данных",
                    errors: parsed.error?.errors?.map((e) => ({
                        field: e.path?.join(".") || "",
                        message: e.message || "Ошибка валидации",
                    })) || [{ message: "Ошибка валидации данных" }],
                });
            }

            return await executeStoredProcedure(
                procedureName,
                parsed.data,
                typeMap,
                nullableKeys,
                res,
                next,
                successMessage
            );
        } catch (error) {
            return next(error);
        }
    };
}

