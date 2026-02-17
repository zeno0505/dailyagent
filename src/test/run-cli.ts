import { runClaude, runCursor } from "../core/cli-runner";

async function main() {
  const testPrompt = '1부터 10까지의 배열을 출력하라. 형식은 무조건 JSON 형식으로 출력해야하며, 그 외에 불필요한 문구는 출력하지 않는다.';

  const claudeResult = await runClaude({
    prompt: testPrompt,
    workDir: process.cwd(),
    timeout: '30m',
  });
  console.log(claudeResult);

  const cursorResult = await runCursor({
    prompt: testPrompt,
    workDir: process.cwd(),
    timeout: '30m',
  });
  console.log(cursorResult);
}

main();