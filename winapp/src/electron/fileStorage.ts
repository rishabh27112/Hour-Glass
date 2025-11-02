import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

export interface TimeEntry {
  apptitle: string;
  appname: string;
  startTime: Date;
  endTime: Date;
  duration: number;
}

export class FileStorageManager {
  private filePath: string;
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-cbc';

  constructor(filename: string = 'timetracker_data.enc') {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, filename);
    
    this.encryptionKey = this.getOrCreateEncryptionKey();
    
    this.ensureFileExists();
  }

  private getOrCreateEncryptionKey(): Buffer {
    const keyPath = path.join(app.getPath('userData'), 'encryption.key');
    
    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath);
      }
    } catch (error) {
      console.error('Error reading encryption key:', error);
    }
    
    // Generate new key
    const key = crypto.randomBytes(32);
    try {
      fs.writeFileSync(keyPath, key);
    } catch (error) {
      console.error('Error writing encryption key:', error);
    }
    
    return key;
  }
  private ensureFileExists(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        // Create file
        fs.writeFileSync(this.filePath, '');
      }
    } catch (error) {
      console.error('Error creating storage file:', error);
    }
  }

  private encrypt(data: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Prepend IV to encrypted data
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw error;
    }
  }

  private decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw error;
    }
  }

  public async appendEntries(entries: TimeEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    try {
      // Convert entries to JSON string
      const data = JSON.stringify(entries) + '\n';
      
      const encryptedData = this.encrypt(data);
      
      await fs.promises.appendFile(this.filePath, encryptedData + '\n', 'utf8');
      
      console.log(`Successfully appended ${entries.length} entries to storage`);
    } catch (error) {
      console.error('Error appending entries to file:', error);
      throw error;
    }
  }

  public async isEmpty(): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(this.filePath);
      return stats.size === 0;
    } catch (error) {
      console.error('Error checking if file is empty:', error);
      return true;
    }
  }

  public async readEntries(): Promise<TimeEntry[]> {
    try {
      const isEmpty = await this.isEmpty();
      if (isEmpty) {
        return [];
      }

      const content = await fs.promises.readFile(this.filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      const allEntries: TimeEntry[] = [];
      
      for (const line of lines) {
        try {
          const decrypted = this.decrypt(line);
          const entries = JSON.parse(decrypted) as TimeEntry[];
          
          // Convert date strings back to Date objects
          entries.forEach(entry => {
            entry.startTime = new Date(entry.startTime);
            entry.endTime = new Date(entry.endTime);
          });
          
          allEntries.push(...entries);
        } catch (error) {
          console.error('Error decrypting/parsing line:', error);
        }
      }
      
      return allEntries;
    } catch (error) {
      console.error('Error reading entries from file:', error);
      throw error;
    }
  }

  public async clearFile(): Promise<void> {
    try {
      await fs.promises.writeFile(this.filePath, '', 'utf8');
      console.log('Storage file cleared successfully');
    } catch (error) {
      console.error('Error clearing file:', error);
      throw error;
    }
  }

  public getFilePath(): string {
    return this.filePath;
  }
}
