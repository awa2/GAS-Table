export interface Data {
  [key: string]: Object;
  _index: number;
};

export default class Table {
  public gid: number;
  public name: string;

  private Spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
  private Sheet: GoogleAppsScript.Spreadsheet.Sheet;
  private Headers: Array<string>;

  constructor(spreadsheetId: String, gid: number) {
    try {
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
        record.forEach((val, i) => {
          obj[this.Headers[i]] = val;
        })
        return obj;
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
      // Header defined
      // Records.push(this.Headers);
      dataArray.forEach((data) => {
        const record: any[] = [];
        this.Headers.forEach(header => {
          switch (header) {
            case 'created_at': record.push(data['created_at']); break;
            case 'updated_at': record.push(new Date()); break;
            default: record.push(data[header]); break;
          }
        });
        Records.push(record);
      });
      this.Sheet.getRange(2, 1, Records.length, this.Headers.length).setValues(Records);
    } else {
      // throw `Table ${this.gid} is not defined, you need 'Dataset.create'`;
      return false;
    }
    return this;
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
      this.Sheet.getRange(index + 2, 1, 1, this.Headers.length).getValues().map((record) => {
        record.forEach((val, i) => {
          obj[this.Headers[i]] = val;
        })
      });
      return obj;
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
    if(Object.keys(data).length){ return this; }
    if (this.Headers.length) {
      let row: number;
      if (index) {
        row = index + 2;
      } else {
        if (data.hasOwnProperty('_index')) {
          row = data._index as number + 2;
        } else {
          row = this.Sheet.getDataRange().getValues().length + 1;
        }
      }
      const oldData = this.get(row);

      if (Array.isArray(data)) {
        // this.Sheet.insertRows(row);
        // this.Sheet.getRange(row, 1, 1, data.length).setValues([data]);
      } else {
        const record: Object[] = [];
        this.Headers.forEach((header, i) => {
          switch (header) {
            case 'created_at':
              if (index) { record.push(data[header]); } else { record.push(new Date()); };
              break;
            case 'updated_at': record.push(new Date()); break;
            default:
              if (data[header] === undefined) {
                record.push(oldData[header]);
              } else {
                record.push(data[header])
              }; break;
          }
        });
        this.Sheet.getRange(row, 1, 1, record.length).setValues([record]);
      }
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
}