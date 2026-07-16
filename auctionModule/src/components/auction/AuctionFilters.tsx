import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import styles from './AuctionFilters.module.css';

interface AuctionFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  tradingStatusFilter: string;
  statusOptions: string[];
  tradingStatusOptions: string[];
  onStatusFilterChange: (value: string) => void;
  onTradingStatusFilterChange: (value: string) => void;
  todayOnly: boolean;
  onTodayOnlyChange: (value: boolean) => void;
}

export function AuctionFilters({
  search,
  onSearchChange,
  statusFilter,
  tradingStatusFilter,
  statusOptions,
  tradingStatusOptions,
  onStatusFilterChange,
  onTradingStatusFilterChange,
  todayOnly,
  onTodayOnlyChange,
}: AuctionFiltersProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <Input
          className={styles.compactControl}
          label="Поиск"
          placeholder="SecCode или ID аукциона…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className={styles.filter}>
        <Select
          className={styles.compactControl}
          label="Статус"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          options={[
            { value: '', label: 'Все статусы' },
            ...statusOptions.map((value) => ({ value, label: value })),
          ]}
        />
      </div>
      <div className={styles.filter}>
        <Select
          className={styles.compactControl}
          label="Торговый статус"
          value={tradingStatusFilter}
          onChange={(e) => onTradingStatusFilterChange(e.target.value)}
          options={[
            { value: '', label: 'Все' },
            ...tradingStatusOptions.map((value) => ({ value, label: value })),
          ]}
        />
      </div>
      <div className={styles.actions}>
        <Button
          variant={todayOnly ? 'primary' : 'secondary'}
          size="sm"
          type="button"
          onClick={() => onTodayOnlyChange(!todayOnly)}
        >
          {todayOnly ? 'Только сегодня ✓' : 'Только сегодня'}
        </Button>
      </div>
    </div>
  );
}
