#!/bin/sh
set -e

APP_USER="nextjs"
APP_GROUP="nodejs"
DATA_DIR="/app/data"

# 宿主机 bind mount 会覆盖镜像内 /app/data 的属主，先以 root 修正权限，
# 避免 SQLite 无法创建/写入 dev.db、dev.db-wal、dev.db-shm。
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R "$APP_USER:$APP_GROUP" "$DATA_DIR" 2>/dev/null || true
fi

# 检查数据库是否存在
if [ ! -f "$DATA_DIR/dev.db" ]; then
  echo "数据库不存在，正在初始化..."
  cp /app/prisma/dev.db.init "$DATA_DIR/dev.db"
  echo "数据库初始化完成"
fi

# 确保 uploads 目录及其子目录存在 (使用 data 卷进行统一存储)
mkdir -p "$DATA_DIR/uploads/wallpapers/bing"
mkdir -p "$DATA_DIR/uploads/wallpapers/custom"

# 将 public/uploads 链接到 data/uploads
if [ ! -L /app/public/uploads ]; then
  # 如果容器构建时存在 public/uploads 且不为空，尝试迁移文件 (防止覆盖现有数据)
  if [ -d /app/public/uploads ]; then
    cp -rn /app/public/uploads/* "$DATA_DIR/uploads/" 2>/dev/null || true
    rm -rf /app/public/uploads
  fi
  ln -s "$DATA_DIR/uploads" /app/public/uploads
fi

# 确保数据目录和上传目录有写入权限
chown -R "$APP_USER:$APP_GROUP" "$DATA_DIR" /app/public/uploads 2>/dev/null || true
chmod -R u+rwX,g+rwX "$DATA_DIR" 2>/dev/null || true
chmod -R 777 /app/public/uploads 2>/dev/null || true

# 启动应用
if [ "$(id -u)" = "0" ]; then
  exec su-exec "$APP_USER:$APP_GROUP" node server.js
fi

exec node server.js
