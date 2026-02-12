#!/usr/bin/env node

/**
 * Cronicle Plugin: Notion 자동화 작업 (Wrapper)
 * 
 * 기존 notion-cron-job.sh를 Cronicle에서 실행하고
 * 진행률을 보고하는 래퍼 플러그인
 * 
 * 작업 매개변수 (Cronicle UI에서 설정 가능):
 *   script_path: 실행할 스크립트 경로 (기본값: ~/dev/dailyagent/notion-cron-job.sh)
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Cronicle 로깅 유틸리티
class CronicleLogger {
    constructor() {
        this.perfStart = Date.now();
    }

    log(message, data = {}) {
        console.log(JSON.stringify({
            time: Date.now(),
            message: message,
            data: data
        }));
    }

    progress(pct, message = '') {
        console.log(`PROGRESS: ${pct}`);
        if (message) {
            console.log(`MESSAGE: ${message}`);
        }
    }

    perf(id) {
        const now = Date.now();
        const elapsed = now - this.perfStart;
        console.log(`PERF: ${id}: ${elapsed}ms`);
        this.perfStart = now;
    }

    error(message, code = 1) {
        console.error(JSON.stringify({
            time: Date.now(),
            error: message,
            code: code
        }));
    }

    success(data = {}) {
        console.log(JSON.stringify({
            time: Date.now(),
            success: true,
            data: data
        }));
    }
}

// 설정 로드
function loadConfig() {
    const args = JSON.parse(process.env.JOB_PARAMS || '{}');
    const homeDir = os.homedir();
    
    const config = {
        scriptPath: args.script_path || 
                   process.env.SCRIPT_PATH || 
                   path.join(homeDir, 'dev/dailyagent/notion-cron-job.sh')
    };
    
    return config;
}

async function main() {
    const logger = new CronicleLogger();
    
    try {
        logger.log('Notion 자동화 작업 시작 (Wrapper)');
        logger.progress(0, '설정 로드 중...');
        
        // 설정 로드
        const config = loadConfig();
        logger.log('설정 완료', config);
        logger.perf('config_load');
        
        // 스크립트 파일 존재 확인
        if (!fs.existsSync(config.scriptPath)) {
            throw new Error(`스크립트를 찾을 수 없습니다: ${config.scriptPath}`);
        }
        
        // 실행 권한 확인
        try {
            fs.accessSync(config.scriptPath, fs.constants.X_OK);
        } catch (err) {
            throw new Error(`스크립트에 실행 권한이 없습니다: ${config.scriptPath}`);
        }
        
        logger.progress(5, '스크립트 검증 완료');
        logger.log('스크립트 실행 준비', { path: config.scriptPath });
        logger.perf('validation');
        
        // 스크립트 실행
        logger.progress(10, 'notion-cron-job.sh 실행 중...');
        
        const child = spawn(config.scriptPath, [], {
            stdio: ['inherit', 'pipe', 'pipe'],
            env: process.env,
            cwd: path.dirname(config.scriptPath)
        });
        
        let stdout = '';
        let stderr = '';
        let lastProgress = 10;
        let lastLogTime = Date.now();
        
        // 진행률 추정을 위한 타이머
        const progressInterval = setInterval(() => {
            // 1분마다 5%씩 진행률 증가 (최대 90%)
            if (lastProgress < 90) {
                lastProgress = Math.min(90, lastProgress + 5);
                logger.progress(lastProgress, '작업 진행 중...');
            }
        }, 60000); // 1분
        
        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            
            // 로그 출력 (너무 자주 출력하지 않도록 제한)
            const now = Date.now();
            if (now - lastLogTime > 5000) { // 5초마다
                console.log(chunk.trim());
                lastLogTime = now;
            }
            
            // 진행률 키워드 감지
            if (chunk.includes('Claude Code를 통해 작업 실행 중')) {
                logger.progress(30, 'Claude Code 실행 중...');
            } else if (chunk.includes('실행 결과:')) {
                logger.progress(80, '작업 완료, 결과 처리 중...');
            }
        });
        
        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            
            // 에러 로그는 항상 출력
            if (chunk.trim()) {
                console.error(chunk.trim());
            }
        });
        
        child.on('close', (code) => {
            clearInterval(progressInterval);
            logger.perf('script_execution');
            
            if (code === 0) {
                logger.progress(100, '작업 완료');
                
                // 결과 파일 찾기
                const logDir = path.join(path.dirname(config.scriptPath), 'logs');
                let resultData = null;
                
                try {
                    // 가장 최근 결과 파일 찾기
                    const files = fs.readdirSync(logDir)
                        .filter(f => f.startsWith('notion-result-') && f.endsWith('.json'))
                        .map(f => ({
                            name: f,
                            path: path.join(logDir, f),
                            time: fs.statSync(path.join(logDir, f)).mtime.getTime()
                        }))
                        .sort((a, b) => b.time - a.time);
                    
                    if (files.length > 0) {
                        const resultFile = files[0].path;
                        const content = fs.readFileSync(resultFile, 'utf8');
                        resultData = JSON.parse(content);
                        logger.log('결과 파일 로드', { file: files[0].name });
                    }
                } catch (err) {
                    logger.log('결과 파일 로드 실패 (무시)', { error: err.message });
                }
                
                logger.success({
                    exitCode: code,
                    scriptPath: config.scriptPath,
                    result: resultData,
                    stdoutLength: stdout.length,
                    stderrLength: stderr.length
                });
                
                process.exit(0);
            } else {
                logger.error(
                    `스크립트 실패 (Exit Code: ${code})\n\n` +
                    `=== STDERR ===\n${stderr}\n\n` +
                    `=== STDOUT (마지막 1000자) ===\n${stdout.substring(Math.max(0, stdout.length - 1000))}`,
                    code
                );
                process.exit(code || 1);
            }
        });
        
        child.on('error', (err) => {
            clearInterval(progressInterval);
            throw new Error(`스크립트 실행 실패: ${err.message}`);
        });
        
    } catch (error) {
        logger.error(error.message);
        logger.log('에러 발생', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// 프로세스 신호 처리
let childProcess = null;

process.on('SIGTERM', () => {
    console.log('SIGTERM 수신, 종료 중...');
    if (childProcess) {
        childProcess.kill('SIGTERM');
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT 수신, 종료 중...');
    if (childProcess) {
        childProcess.kill('SIGINT');
    }
    process.exit(0);
});

// 예외 처리
process.on('uncaughtException', (err) => {
    console.error(JSON.stringify({
        time: Date.now(),
        error: '예상치 못한 오류 발생',
        message: err.message,
        stack: err.stack
    }));
    process.exit(1);
});

// 실행
main();
