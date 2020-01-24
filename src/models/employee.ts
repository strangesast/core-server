import {model, Schema} from 'mongoose';

const employeeSchema = new Schema({
  id: {
    type: Number,
    required: true,
  },
  code: String,
  nameFirst: String,
  nameMiddle: String,
  nameLast: String,
}, {collection: 'employees'});

export const Employee = model('Employee', employeeSchema);

export default Employee;
