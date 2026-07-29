# Node 20 (Debian bookworm) gives us the API runtime plus the JS runner.
# We add the remaining language toolchains from apt.
FROM node:20-bookworm

# g++ (C/C++), python3 (Python), default-jdk (Java 17, source-file mode),
# golang-go (Go), rustc (Rust; uses gcc from g++ as its linker).
# TypeScript runs via the tsx dependency (installed with npm). ca-certificates
# for outbound TLS.
RUN apt-get update && apt-get install -y --no-install-recommends \
      g++ \
      python3 \
      default-jdk \
      golang-go \
      rustc \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Go needs a writable cache/home; the container runs as root by default.
ENV HOME=/root

# Pre-warm the Go build cache so the first user run doesn't pay the cold
# stdlib-compile cost (which can exceed the execution timeout).
RUN printf 'package main\nimport "fmt"\nfunc main(){ fmt.Println("warmup") }\n' > /tmp/warmup.go \
 && go run /tmp/warmup.go \
 && rm -f /tmp/warmup.go

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "index.js"]
