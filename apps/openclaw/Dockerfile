# Node.js 22 LTS (Bullseye) 사용
FROM node:22-bullseye

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치 (필요한 경우)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    bash \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# OpenClaw 전역 설치 (권한 문제 방지)
RUN npm install -g openclaw@latest --unsafe-perm=true --allow-root

# OpenClaw 설정 디렉토리 생성
RUN mkdir -p /root/.openclaw/workspace

# 기본 볼륨 설정 (워크스페이스 영속성)
VOLUME ["/root/.openclaw"]

# 포트 설정 (Gateway용)
EXPOSE 18789

# 애플리케이션 실행
# --install-daemon은 컨테이너 환경에서 복잡할 수 있으므로 직접 gateway 실행
ENTRYPOINT ["openclaw"]
CMD ["gateway", "--port", "18789", "--verbose"]
