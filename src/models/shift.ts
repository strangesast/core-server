const {model, Schema, ObjectId} = require('mongoose');

const punchSchema = new Schema({
  id: ObjectId,
  employeeId: Number,
  date: Date,
  pollDate: Date,
}, {collection: 'punches'});

export const Punch = model('Punch', punchSchema);

const shiftSchema = new Schema({
  id: ObjectId,
  employeeId: Number,
  startDate: Date,
  endDate: Date,
  punches: [{ type : ObjectId, ref: 'Punch' }],
}, {collection: 'shifts'});

export const Shift = model('Shift', shiftSchema);
