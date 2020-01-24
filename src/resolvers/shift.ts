export default {
  Query: {
    shifts: async (parent, args, { models }) => {
      return await models.Shift.find();
    },
  }
};
