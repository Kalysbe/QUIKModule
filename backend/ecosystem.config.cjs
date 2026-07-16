/**
 * PM2 Ecosystem Configuration
 * Для запуска как Windows Service используйте:
 * pm2 start ecosystem.config.cjs
 * pm2 save
 * pm2-windows-startup install
 */

module.exports = {
  apps: [{
    name: 'quikmodule',
    script: './src/server.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Автоматический перезапуск
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Обработка ошибок
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    
    // Переменные окружения
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      SERVER_HOST: '127.0.0.1', // КРИТИЧЕСКИ ВАЖНО: не использовать 0.0.0.0
      LOG_LEVEL: 'info'
    },
    
    // Настройки перезапуска
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Merge logs
    merge_logs: true,
    
    // Source map support
    source_map_support: true,
    
    // Instance vars
    instance_var: 'INSTANCE_ID'
  }]
};
