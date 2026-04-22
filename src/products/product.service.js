import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ALLOWED_SORT_FIELDS = ['id', 'name', 'price', 'category', 'stock', 'createdAt'];
const ALLOWED_ORDER_VALUES = ['asc', 'desc'];
const ALLOWED_PRODUCT_FIELDS = [
  'id',
  'name',
  'description',
  'price',
  'category',
  'stock',
  'imageUrl',
  'isActive',
  'createdAt',
  'updatedAt',
];

function createBadRequestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parsePositiveInt(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createBadRequestError(`${label} must be a positive integer`);
  }
  return parsed;
}

function buildSelect(fieldsQuery) {
  if (!fieldsQuery) return undefined;

  const requestedFields = fieldsQuery
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);

  if (requestedFields.length === 0) {
    throw createBadRequestError('fields must contain at least one valid field');
  }

  const invalidFields = requestedFields.filter((field) => !ALLOWED_PRODUCT_FIELDS.includes(field));
  if (invalidFields.length > 0) {
    throw createBadRequestError(`Invalid field(s): ${invalidFields.join(', ')}`);
  }

  return requestedFields.reduce((acc, field) => {
    acc[field] = true;
    return acc;
  }, {});
}

export async function getProducts(query) {
  const page = parsePositiveInt(query.page, DEFAULT_PAGE, 'page');
  const requestedLimit = parsePositiveInt(query.limit, DEFAULT_LIMIT, 'limit');
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy || 'id';
  if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
    throw createBadRequestError(`sortBy must be one of: ${ALLOWED_SORT_FIELDS.join(', ')}`);
  }

  const order = (query.order || 'asc').toLowerCase();
  if (!ALLOWED_ORDER_VALUES.includes(order)) {
    throw createBadRequestError('order must be either asc or desc');
  }

  const select = buildSelect(query.fields);
  const [total, products] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({
      skip,
      take: limit,
      orderBy: { [sortBy]: order },
      select,
    }),
  ]);

  return {
    data: products,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getProductById(id) {
  return prisma.product.findUnique({ where: { id } });
}