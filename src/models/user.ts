import bcrypt from 'bcrypt';
import {model, Schema} from 'mongoose';
import isEmail from 'validator/lib/isEmail';


const userSchema = new Schema({
  id: {
    type: Schema.Types.ObjectId,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    unique: true,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
    validate: [isEmail, 'Not a valid email address'],
  },
  employee: {
    type: Number,
    required: false,
    unique: true, // may be undesireable if employees have multiple accounts
    ref: 'Employee',
  },
  password: {
    type: String,
    required: true,
    minLength: 3,
  },
  roles: [String],
}, {
  collection: 'users',
  timestamps: true,
});

userSchema.methods.generatePasswordHash = async function() {
  const saltRounds = 10;
  return await bcrypt.hash(this.password, saltRounds);
};

userSchema.methods.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

export interface IUser {
  id: string;
  username: string;
  email: string;
  password?: string;
  roles: string[];
}

export const User = model('User', userSchema);

export default User;
