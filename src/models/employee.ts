const {model, Schema} = require('mongoose');

const employeeSchema = new Schema({
  id: Number,
  code: String,
  nameFirst: String,
  nameMiddle: String,
  nameLast: String,
}, {collection: 'employees'});

export const Employee = model('Employee', employeeSchema);
