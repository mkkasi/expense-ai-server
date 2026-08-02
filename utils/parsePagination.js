/**
 * Parses common list-query params (page, limit, sortBy, sortOrder) and
 * returns both the Mongoose query options and a `meta` builder.
 *
 * Usage:
 *   const { skip, limit, sort, buildMeta } = parsePagination(req.query);
 *   const [items, total] = await Promise.all([
 *     Model.find(filter).sort(sort).skip(skip).limit(limit),
 *     Model.countDocuments(filter),
 *   ]);
 *   res.json({ items, meta: buildMeta(total) });
 */
const parsePagination = (query, defaultSort = '-date') => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  let sort = defaultSort;
  if (query.sortBy) {
    const order = query.sortOrder === 'asc' ? '' : '-';
    sort = `${order}${query.sortBy}`;
  }

  const buildMeta = (total) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  });

  return { page, limit, skip, sort, buildMeta };
};

module.exports = parsePagination;
