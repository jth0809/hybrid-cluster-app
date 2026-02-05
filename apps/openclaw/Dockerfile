# Node.js 22 LTS (Bullseye) 사용
# Node.js 22 (Bookworm) 사용 - CMake 3.25+ 및 최신 glibc 포함
FROM node:22-bookworm

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치
# node-llama-cpp 빌드를 위한 필수 도구들 (Bookworm 기준)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    bash \
    build-essential \
    python3 \
    python-is-python3 \
    cmake \
    clang \
    pkg-config \
    ninja-build \
    && rm -rf /var/lib/apt/lists/*


# npm 최신 버전 업데이트
RUN npm install -g npm@latest

# OpenClaw 전역 설치 (권한 문제 방지)
RUN npm install -g openclaw@latest

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
