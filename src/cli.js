'use strict';

const { Command } = require('commander');
const pkg = require('../package.json');
const chalk = require('chalk');

const program = new Command();

program
  .name('dailyagent')
  .description('AI-powered task automation CLI')
  .version(pkg.version);

program
  .command('init')
  .description('설정 초기화 위저드')
  .action(async () => {
    const { initCommand } = require('./commands/init');
    await initCommand();
  });

program
  .command('register')
  .description('새 작업 등록')
  .action(async () => {
    const { registerCommand } = require('./commands/register');
    await registerCommand();
  });

program
  .command('list')
  .description('등록된 작업 목록 조회')
  .action(async () => {
    const { listCommand } = require('./commands/list');
    await listCommand();
  });

program
  .command('unregister <name>')
  .description('등록된 작업 삭제')
  .action(async (name) => {
    const { unregisterCommand } = require('./commands/unregister');
    await unregisterCommand(name);
  });

program
  .command('run <name>')
  .description('지정된 작업 즉시 실행')
  .action(async (name) => {
    const { runCommand } = require('./commands/run');
    await runCommand(name);
  });

program
  .command('pause <name>')
  .description('작업 일시 중지')
  .action(async (name) => {
    const { pauseCommand } = require('./commands/pause');
    await pauseCommand(name);
  });

program
  .command('resume <name>')
  .description('일시 중지된 작업 재개')
  .action(async (name) => {
    const { resumeCommand } = require('./commands/resume');
    await resumeCommand(name);
  });

program
  .command('status <name>')
  .description('작업 상태 및 실행 이력 조회')
  .option('-n, --count <number>', '표시할 실행 이력 수', parseInt)
  .action(async (name, options) => {
    const { statusCommand } = require('./commands/status');
    await statusCommand(name, options);
  });

module.exports = { program };
