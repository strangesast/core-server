import {model, Schema} from 'mongoose';

const punchSchema = new Schema({
  id: {
    type: Number,
    unique: true,
    required: true,
  },
  employeeId: Number,
  date: Date,
  pollDate: Date,
}, {collection: 'punches'});

export const Punch = model('Punch', punchSchema);

const shiftSchema = new Schema({
  id: Schema.Types.ObjectId,
  employeeId: Number,
  startDate: Date,
  endDate: Date,
  punches: [{ type: Number, ref: 'Punch' }],
}, {collection: 'shifts'});

export const Shift = model('Shift', shiftSchema);
