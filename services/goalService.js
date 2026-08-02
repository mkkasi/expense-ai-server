const Goal = require('../models/Goal');
const ApiError = require('../utils/ApiError');

const listGoals = async (userId, { status } = {}) => {
  const filter = { user: userId };
  if (status === 'completed') filter.isCompleted = true;
  if (status === 'active') filter.isCompleted = false;

  return Goal.find(filter).sort('targetDate');
};

const getGoalById = async (userId, id) => {
  const goal = await Goal.findOne({ _id: id, user: userId });
  if (!goal) throw ApiError.notFound('Savings goal not found');
  return goal;
};

const createGoal = async (userId, payload) => Goal.create({ ...payload, user: userId });

const updateGoal = async (userId, id, payload) => {
  const goal = await getGoalById(userId, id);
  Object.assign(goal, payload);
  await goal.save();
  return goal;
};

/**
 * Adds (or removes, with a negative amount) a contribution to a goal's
 * current progress. Kept separate from a generic update so the client can
 * do "add ₹500 to this goal" without re-sending the whole object.
 */
const contributeToGoal = async (userId, id, amount) => {
  const goal = await getGoalById(userId, id);
  goal.currentAmount = Math.max(0, goal.currentAmount + amount);
  await goal.save();
  return goal;
};

const deleteGoal = async (userId, id) => {
  const goal = await getGoalById(userId, id);
  await goal.deleteOne();
};

module.exports = { listGoals, getGoalById, createGoal, updateGoal, contributeToGoal, deleteGoal };
