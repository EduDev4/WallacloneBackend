const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const _ = require('lodash');
const createError = require('http-errors');
const User = require('../models/User');

const {
  sendResetPasswordEmail,
  sendConfirmationEmail,
} = require('./mailerController');

// TODO: Borrado de usuario
// TODO: Poner o quitar favoritos
// TODO: Actualización de datos de usuario

class UserController {
  /**
   * POST /login
   */
  async login(req, res, next) {
    try {
      const { username } = req.body;
      const { passwd } = req.body;
      // console.log(req.body);

      const user = await User.findOne({
        username: username,
        confirmed: true,
      }).select('+passwd');

      if (!user || !(await bcrypt.compare(passwd, user.passwd))) {
        return next(createError(401, 'Invalid credentials!'));
        // COMPLETE crear error con new Error a next
      }

      jwt.sign(
        { _id: user._id },
        process.env.JWT_SECRET,
        {
          expiresIn: '2d',
        },
        (err, tokenJWT) => {
          if (err) return next(err);

          res.status(200).json({
            status: 'success',
            requestedAt: req.requestTime,
            data: {
              tokenJWT: tokenJWT,
              username: username,
              userEmail: user.email,
            },
          });
        },
      );
    } catch (error) {
      console.log('error:', error);
      next(createError(401, error.message));
    }
  }

  /**
   * POST /   (Singup)
   */
  async signup(req, res, next) {
    try {
      const newuser = new User(req.body);

      newuser.passwd = await User.hashPassword(newuser.passwd);

      User.findOne(
        {
          $or: [{ email: newuser.email }, { username: newuser.username }],
        },
        (err, user) => {
          //Si ya hay usuario con ese email o username
          if (user) {
            //Si el usuario esta confirmado o pendiente de confirmar
            if (user.confirmed || Date.now() < user.expires)
              return res.status(400).json({
                auth: false,
                message: 'email or username already exits',
              });
            //Sino, Borramos el usuario cuyo token expiró y no está confirmado
            try {
              user.remove();
            } catch (error) {
              console.log(error);
            }
          }

          //Si el usuario no existe en la BD directamente lo creamos

          newuser.token = crypto
            .createHash('md5')
            .update(Math.random().toString().substring(2))
            .digest('hex');

          // eslint-disable-next-line no-shadow
          newuser.save((err, doc) => {
            if (err) {
              console.log(err);
              // COMPLETE Usar createError
              return next(createError(400, err.message));
            }
            // TODO enviar email al usuario con el enlace para confirmar:
            // TODO ej: http://localhost:3000/apiv1/users/confirm/03a1ad862e706f3aabc3cf234a02e1cd
            res.status(200).json({
              succes: true,
              user: doc,
            });
          });
        },
      );
    } catch (error) {
      console.log(error);
      return next(createError(400, error.message));
    }
  }

  /**
   * GET /confirm/:token   (Singup confirmation)
   */
  async signupConfirmation(req, res, next) {
    const { token } = req.params;

    try {
      if (!token) {
        return res.status(404).json({
          succes: false,
          message: 'Token missing',
        });
      }

      const user = await User.findOne({ token: token });

      if (!user) {
        return res.status(404).json({
          succes: false,
          message: 'The token provided is not valid',
        });
      }

      if (Date.now() > user.expires) {
        await user.remove();
        return res.status(200).json({ error: 'token expired' });
      }

      user.confirmed = true;
      user.token = '';
      user.expires = '';
      await user.save();

      return res
        .status(200)
        .json({ succes: true, message: 'User email confirmed' });
    } catch (err) {
      console.log(err);
      // COMPLETE usar error handler
      return next(createError(404, err.message));
    }
  }

  /**
   * PUT /forgotPass
   */
  async forgotPass(req, res, next) {
    const { email } = req.body;
    try {
      const user = await User.find({ email });
      if (!user) {
        return res.status(422).send("User email doesn't exist!");
      }
      const hash = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
      const obj = {
        hash: hash,
      };
      const newUser = _.extend(...user, obj);
      await newUser.save();
      await sendResetPasswordEmail({ toUser: email }, hash);
      return res.json({
        message: 'Please check your email in order to reset the password!',
      });
    } catch (err) {
      return next(createError(422, err.message));
    }
  }

  /**
   * POST /forgotPass/confirmation
   */
  async forgotPassConfirm(req, res, next) {
    const { passwd, hash } = req.body;
    const user = await User.find({ hash });
    const { email } = user[0];

    try {
      const obj = {
        passwd: await User.hashPassword(passwd),
        hash: hash,
      };
      const newUser = _.extend(...user, obj);
      await newUser.save();
      await sendConfirmationEmail({ toUser: email });
      return res.json({ message: 'Password has been resseted' });
    } catch (err) {
      return next(createError(422, err.message));
    }
  }

  /**
   * PATCH /userData/:username
   */
  async updateUserData(req, res, next) {
    const { newUsername, newUserEmail, newPasswd } = req.body;
    const currentUsername = req.params.username;

    try {
      const currentUser = await User.findOne({
        username: currentUsername,
      });
      const newData = {};

      if (newUsername) {
        if (await User.find({ username: newUsername })) {
          return next(createError(422, 'This username is already in use'));
        }
        newData.username = newUsername;
      }

      if (newUserEmail) {
        if (await User.find({ email: newUserEmail })) {
          return next(createError(422, 'This email is already in use'));
        }
        newData.email = newUserEmail;
      }

      if (newPasswd) {
        newData.passwd = await User.hashPassword(newPasswd);
      }

      const newUserData = await User.findOneAndUpdate(
        { _id: currentUser._id },
        newData,
        {
          new: true,
          useFindAndModify: false,
        },
      );

      res.status(200).json({
        status: 'success',
        requestedAt: req.requestTime,
        data: {
          username: newUserData.username,
          userEmail: newUserData.email,
        },
      });
    } catch (error) {
      return next(createError(404, error.message));
    }
  }
}

module.exports = new UserController();
