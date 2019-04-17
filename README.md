# GAS-Table
Table module provides CRUD-like interface and JSON based data handling with Google Spreadsheet.
This is TypeScript modules for Google Apps Script with `clasp`.

## Example
```TypeScript
const Users = new Table('<YOUR_SPREADSHEET_ID>',123456);
Users.add({ name : 'John Smith', age : 20});

const user = Users.get(1);
user.age = 21;
Users.update(user);
```

## Reference
### Initialize & push
```TypeScript
import Table from '@ts-module-for-gas/gas-table';
```
### Global Service
#### createTable(name: string, schema: string[] | Object)
 * `name` Name of the spreadsheet which using as Table
 * `schema` 

Example:
```TypeScript
const Users = Table.createTable('Users',)
```