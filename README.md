## SpreadsheetTable
Table module provides CRUD like interface and JSON based data handling with Google Spreadsheet.

### Example
```TypeScript
const Users = new Table('<YOUR_SPREADSHEET_ID>',123456);
Users.add({ name : 'John Smith', age : 20});

const user = Users.get(1);
user.age = 21;
Users.update(user);
```
