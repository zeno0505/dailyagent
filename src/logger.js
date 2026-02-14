'use strict';

const fs = require('fs-extra');
const path = require('path');
const { LOGS_DIR } = require('./config');

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

class Logger {
  constructor(jobName) {
    this.jobName = jobName;
    this.logFile = null;
  }

  async init() {
    await fs.ensureDir(LOGS_DIR);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    this.logFile = path.join(LOGS_DIR, `${this.jobName}-${ts}.log`);
  }

  _format(level, message) {
    return `[${timestamp()}] [${level}] ${message}`;
  }

  async _write(line) {
    if (this.logFile) {
      await fs.appendFile(this.logFile, line + '\n');
    }
  }

  async info(message) {
    const line = this._format('INFO', message);
    console.log(line);
    await this._write(line);
  }

  async warn(message) {
    const line = this._format('WARN', message);
    console.warn(line);
    await this._write(line);
  }

  async error(message) {
    const line = this._format('ERROR', message);
    console.error(line);
    await this._write(line);
  }

  async debug(message) {
    const line = this._format('DEBUG', message);
    await this._write(line);
  }
}

module.exports = { Logger };
