export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
  maxLimit?: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

/**
 * Parse and validate pagination query params.
 */
export const parsePagination = (
  params: PaginationParams,
  maxLimit = 100,
): PaginationResult => {
  const page = Math.max(1, parseInt(String(params.page ?? 1), 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(String(params.limit ?? 10), 10) || 10),
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
};

/**
 * Build pagination metadata for API responses.
 */
export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasMore: page * limit < total,
  hasPrevious: page > 1,
});

/**
 * Combined helper: parse params + build response meta.
 */
export const paginate = (
  params: PaginationParams,
  maxLimit = 100,
): PaginationResult & { buildMeta: (total: number) => PaginationMeta } => {
  const pagination = parsePagination(params, maxLimit);
  return {
    ...pagination,
    buildMeta: (total: number) =>
      buildPaginationMeta(total, pagination.page, pagination.limit),
  };
};