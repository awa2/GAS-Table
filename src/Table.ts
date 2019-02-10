export interface Data {
  [key: string]: Object;
  _index: number;
};

export default class Table {
  public id: string;
  public gid: number;
  public name: string;

  private Spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
  private Sheet: GoogleAppsScript.Spreadsheet.Sheet;
  private Headers: Array<string>;

  constructor(spreadsheetId: string, gid: number) {
    try {
      this.id = spreadsheetId;
      this.gid = gid;

      this.Spreadsheet = SpreadsheetApp.openById(spreadsheetId as string);
      let _name = '';
      this.Spreadsheet.getSheets().forEach(sheet => {
        if (sheet.getSheetId() == gid) {
          _name = sheet.getSheetName();
        };
      });
      if (!_name) { throw `Can not find #${gid}`; }

      this.name = _name;
      this.Sheet = this.Spreadsheet.getSheetByName(_name);
      this.Headers = this.Sheet.getDataRange().getValues()[0].map(col => {
        return col.toString();
      })

      return this;
    } catch (error) {
      console.error(error);
      Logger.log(JSON.stringify(error));
      throw `Can not connect ${spreadsheetId}#${gid}`;
    }
  }

  public addAll(dataArray: Data[]) {
    return this.deleteAll().updateAll(dataArray);
  }

  public getAll() {
    return this.Sheet.getDataRange().getValues().map((record, index) => {
      const obj: Data = { _index: index - 1 };
      if (index == 0) {
        return obj;
      } else {
        return this.map_to_data(record, obj);
      }
    }).slice(1);
  }
  public list() { return this.getAll() }

  public getValues() {
    return this.Sheet.getDataRange().getValues();
  }
  public getAllAsArray() { return this.getValues(); }

  public updateAll(dataArray: Data[]) {
    const Records: Array<any> = [];
    if (this.Headers.length) {
      dataArray.forEach((data) => {
        const record = this.map_to_record(data);
        Records.push(record);
      });
      this.Sheet.getRange(2, 1, Records.length, this.Headers.length).setValues(Records);
      return this;
    } else {
      return false;
    }
  }
  public bulk_insert(dataArray: Data[]) {
    return this.updateAll(dataArray);
  }

  public deleteAll() {
    // this.Sheet.clear();
    const lastrow = this.Sheet.getLastRow() - 1;
    if (1 < lastrow) {
      this.Sheet.deleteRows(2, this.Sheet.getLastRow() - 1);
    }
    return this;
  }

  public add(data: Object) {
    return this.update(data);
  }
  // public append(data: Data) { return this.add(data); };
  // public post(data: Data) { return this.add(data); };

  public get(index: number): Data {
    if (this.Headers.length) {
      const obj: Data = { _index: index };
      const record = this.Sheet.getRange(index + 2, 1, 1, this.Headers.length).getValues()[0];
      return this.map_to_data(record, obj);
    } else {
      throw "header is not defined";
    }
  }

  public getAsArray(index: number) {
    if (this.Headers.length) {
      return this.Sheet.getRange(index + 2, 1, 1, this.Headers.length).getValues()[0];
    } else {
      throw "header is not defined";
    }
  }

  public update(data: Object, index?: number): Table
  public update(data: Data, index?: number): Table
  public update(data: any, index?: number) {
    if (!Object.keys(data).length) { return this; }
    if (this.Headers.length) {
      let row: number;
      if (index) {
        row = index + 2;
        data._index = index;
      } else {
        if (data.hasOwnProperty('_index')) {
          row = data._index as number + 2;
        } else {
          row = this.Sheet.getDataRange().getValues().length + 1;
          data._index = row - 2;
        }
      }
      const record = this.map_to_record(data);
      this.Sheet.getRange(row, 1, 1, record.length).setValues([record]);

      return this;
    } else {
      throw "header is not defined";
    }
  }
  public set(data: Data, index?: number) { return this.update(data); }
  public put(data: Data, index?: number) { return this.update(data); }

  public delete(index: number) {
    if (this.Headers.length) {
      this.Sheet.getRange(index + 2, 1, 1, this.Headers.length).clearContent();
      return this;
    } else {
      throw "header is not defined";
    }
  }

  public deleteAndRemoveRow(index: number) {
    if (this.Headers.length) {
      this.Sheet.deleteRow(index + 2);
    } else {
      throw "header is not defined";
    }
  }

  public getLast() {
    const lastIndex = this.Sheet.getDataRange().getNumRows() - 2;
    return this.get(lastIndex);
  }

  private map_to_record(newData: Data) {
    const index = newData._index;
    const oldData = this.get(index);
    return this.Headers.map((header, i) => {
      switch (header) {
        case 'created_at':
          if (oldData.created_at) {
            return new Date(oldData.created_at as string).toISOString();
          } else {
            return new Date().toISOString();
          }
          break;
        case 'updated_at':
          return new Date().toISOString();
          break;
        case 'lock_version':
          return Table.md5sum(newData);
          break;
        default:
          if (newData[header] === undefined) {
            // Merging record (Partial update)
            return oldData[header];
          } else {
            switch (this.getType(newData[header])) {
              case 'date':
                return (newData[header] as Date).toISOString();
                break;
              default:
                return newData[header];
            }
          };
          break;
      }
    });
  }

  private map_to_data(record: Object[], obj: Data) {
    record.forEach((value, i) => {
      if (typeof value === 'string') {
        if (value.match(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/)) {
          obj[this.Headers[i]] = new Date(value);
        }
      } else {
        obj[this.Headers[i]] = value;
      }
    })
    return obj;
  }

  private getType(obj: any) {
    return Object.prototype.toString.call(obj).toLowerCase().slice(8, -1);
  }

  public static copyAllTo(srcTable: Table, dstTable: Table) {
    const data = srcTable.getAll();
    dstTable.addAll(data as Data[]);
  }

  public static diff(ATable: Table, BTable: Table, option?: { without?: string, only?: string }) {
    const a = ATable.getAll();
    const b = BTable.getAll();
    const d: { [table_name_and_index: string]: { diff: 'add' | 'delete', data: Data } } = {};
    const diff = [];

    a.forEach((a_record, i) => {
      if (b.some(b_record => {
        return Table.isEqual(a_record, b_record, option);
      })) {
        // b_record includes a_record
      } else {
        d[`${i}@${ATable.name}[#${ATable.gid}]`] = {
          diff: 'delete',
          data: a_record
        }
      }
    });

    b.forEach((b_record, i) => {
      if (a.some((a_record) => {
        return Table.isEqual(b_record, a_record, option);
      })) {
        // a_record includes b_record
      } else {
        d[`${i}@${BTable.name}[#${BTable.gid}]`] = {
          diff: 'add',
          data: b_record
        }
      }
    });

    for (const k in d) {
      diff.push({
        index: k,
        diff: d[k].diff,
        data: d[k].data
      })
    }
    return diff;
  }

  private static isEqual(a: any, b: any, option?: { without?: string, only?: string }) {
    let bln = true;
    let without = '';
    let only = '';

    if (option) {
      if (option['without']) {
        without = option['without'];
      }
      if (option['only']) {
        only = option['only'];
      }
    }

    if (only) {
      // just only specific key comparing
      switch (Object.prototype.toString.call(a[only]).slice(8, -1).toLowerCase()) {
        case 'number': bln = bln && (a[only] === b[only]); break;
        case 'string': bln = bln && (a[only] === b[only]); break;
        case 'boolean': bln = bln && (a[only] === b[only]); break;
        default: bln = bln && (a[only].toString() === b[only].toString()); break;
      }
    } else {
      // all each property comparing
      for (const key in a) {
        if (a.hasOwnProperty(key)) {
          if (without === key) {
            // Not comparing
          } else {
            switch (Object.prototype.toString.call(a[key]).slice(8, -1).toLowerCase()) {
              case 'number': bln = bln && (a[key] === b[key]); break;
              case 'string': bln = bln && (a[key] === b[key]); break;
              case 'boolean': bln = bln && (a[key] === b[key]); break;
              default: bln = bln && (a[key].toString() === b[key].toString()); break;
            }
          }
        }
      }

    }
    return bln;
  }

  public static createTable(name: string, schema: string[] | Object) {
    const Spreadsheet = SpreadsheetApp.create(name);
    const sid = Spreadsheet.getId();
    const Sheet = Spreadsheet.getSheets()[0];
    const gid = Sheet.setName(name).getSheetId();
    Sheet.deleteColumns(3, Sheet.getMaxColumns() - 3);
    Sheet.deleteRows(1, Sheet.getMaxRows() - 1);
    if (Array.isArray(schema)) {
      Sheet.getRange(1, 1, 1, schema.length + 3).setValues([['created_at', 'updated_at', 'lock_version'].concat(schema)]).setFontWeight("bold");
    } else {
      const headers = [];
      for (const key in schema) {
        if (schema.hasOwnProperty(key)) {
          headers.push(key);
        }
      }
      Sheet.getRange(1, 1, 1, headers.length + 3).setValues([['created_at', 'updated_at', 'lock_version'].concat(headers)]).setFontWeight("bold");
    }
    Sheet.getRange(1, 1, 1, 3).setFontColor("red");
    Sheet.autoResizeColumns(1, Sheet.getMaxColumns());
    return new Table(sid, gid);
  }

  public static migrate(table: Table, schema?: string[] | Object) {
    const Spreadsheet = SpreadsheetApp.openById(table.id);
    const Sheet = Spreadsheet.getSheetByName(table.name);
    const headers = Sheet.getDataRange().getValues()[0];
    if (schema) {
      if (Array.isArray(schema)) {
        schema.forEach(new_header => {
          if (headers.some(header => { return new_header === header })) {
          } else {
            headers.push(new_header);
          }
        });
      } else {
        for (const new_header in schema) {
          if (schema.hasOwnProperty(new_header)) {
            if (headers.some(header => { return new_header === header })) {
            } else {
              headers.push(new_header);
            }
          }
        }
      }
    } else {
      for (const new_header in table) {
        if (table.hasOwnProperty(new_header)) {
          if (headers.some(header => { return new_header === header })) {
          } else {
            headers.push(new_header);
          }
        }
      }

    }
    Sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    Sheet.getRange(1, 1, 1, 3).setFontColor("red");
    Sheet.autoResizeColumns(1, Sheet.getMaxColumns());
    return new Table(table.id, table.gid);
  }

  public static md5sum(data: any) {
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(data), Utilities.Charset.UTF_8);
    return hash.map(h => {
      if (h < 0) { h += 256; }
      const t = h.toString(16)
      return t.length === 1 ? '0' + t : t;
    }).join('');
  }
}