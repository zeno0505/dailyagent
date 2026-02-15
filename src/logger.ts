import fs from 'fs-extra';
import path from 'path';
import { LOGS_DIR } from './config';

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

export class Logger {
  private jobName: string;
  private logFile: string | null = null;

  constructor(jobName: string) {
    this.jobName = jobName;
  }

  async init(): Promise<void> {
    await fs.ensureDir(LOGS_DIR);
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .replace('Z', '');
    this.logFile = path.join(LOGS_DIR, `${this.jobName}-${ts}.log`);
  }

  private _format(level: string, message: string): string {
    return `[${timestamp()}] [${level}] ${message}`;
  }

  private async _write(line: string): Promise<void> {
    if (this.logFile) {
      await fs.appendFile(this.logFile, line + '\n');
    }
  }

  async info(message: string): Promise<void> {
    const line = this._format('INFO', message);
    console.log(line);
    await this._write(line);
  }

  async warn(message: string): Promise<void> {
    const line = this._format('WARN', message);
    console.warn(line);
    await this._write(line);
  }

  async error(message: string): Promise<void> {
    const line = this._format('ERROR', message);
    console.error(line);
    await this._write(line);
  }

  async debug(message: string): Promise<void> {
    const line = this._format('DEBUG', message);
    await this._write(line);
  }
}
