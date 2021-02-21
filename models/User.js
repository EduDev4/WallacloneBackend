const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      index: true,
      required: [true, 'Please add a username'],
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
      required: [true, 'Please provide an email'],
    },
    passwd: {
      type: String,
      minlength: 6,
      select: false,
      required: [true, 'Please provide a password'],
    },
    confirmed: {
      type: Boolean,
      default: false,
    },
    token: String,
    expires: {
      type: Number,
      //default: Date.now(), //0 seg para test de tokens expirados
      default: Date.now() + 10800000, //3 hours
    },
    // TODO: próxima reunión comentar/explicar esto de los favoritos
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Advert' }],
  },
  {
    timestamps: true,
  },
);

userSchema.statics.hashPassword = function (clearPass) {
  return bcrypt.hash(clearPass, 8);
};

const User = mongoose.model('User', userSchema);

module.exports = User;