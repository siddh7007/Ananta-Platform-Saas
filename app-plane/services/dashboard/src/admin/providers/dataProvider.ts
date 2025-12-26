import { DataProvider } from 'react-admin';
import { apiClient, buildResourcePath } from '@/admin/lib/apiClient';

type ListPayload<T = unknown> = {
  data?: T[];
  items?: T[];
  total?: number;
};

const toListResult = <T>(payload: ListPayload<T> | T[] | undefined, fallbackTotal?: number) => {
  if (!payload) {
    return { data: [] as T[], total: fallbackTotal ?? 0 };
  }

  if (Array.isArray(payload)) {
    return { data: payload, total: fallbackTotal ?? payload.length };
  }

  if (Array.isArray(payload.data)) {
    return { data: payload.data, total: payload.total ?? payload.data.length };
  }

  if (Array.isArray(payload.items)) {
    return { data: payload.items, total: payload.total ?? payload.items.length };
  }

  return { data: [] as T[], total: fallbackTotal ?? 0 };
};

const buildListParams = (params: Parameters<DataProvider['getList']>[1]) => {
  const { pagination = { page: 1, perPage: 25 }, sort, filter } = params;
  const query: Record<string, unknown> = {
    page: pagination.page,
    perPage: pagination.perPage,
  };

  if (sort?.field) {
    query.sort = sort.field;
    query.order = sort.order ?? 'ASC';
  }

  if (filter && Object.keys(filter).length > 0) {
    query.filter = JSON.stringify(filter);
  }

  return query;
};

const unwrapRecord = <T>(payload: { data?: T } | T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
    return payload.data;
  }
  return payload as T;
};

const listRequest = async (resource: string, params: Parameters<DataProvider['getList']>[1]) => {
  const response = await apiClient.get(buildResourcePath(resource), {
    params: buildListParams(params),
  });

  const headerTotal = Number(response.headers?.['x-total-count']);
  const { data, total } = toListResult(response.data, Number.isNaN(headerTotal) ? undefined : headerTotal);

  return { data, total };
};

export const dataProvider: DataProvider = {
  getList: async (resource, params) => listRequest(resource, params),

  getOne: async (resource, params) => {
    const response = await apiClient.get(`${buildResourcePath(resource)}/${params.id}`);
    return { data: unwrapRecord(response.data) };
  },

  getMany: async (resource, params) => {
    const response = await apiClient.get(buildResourcePath(resource), {
      params: {
        ids: params.ids.join(','),
      },
    });
    const { data } = toListResult(response.data);
    return { data };
  },

  getManyReference: async (resource, params) => {
    const listParams = {
      ...params,
      filter: {
        ...(params.filter || {}),
        [params.target]: params.id,
      },
    };
    return listRequest(resource, listParams);
  },

  create: async (resource, params) => {
    const response = await apiClient.post(buildResourcePath(resource), params.data);
    return { data: unwrapRecord(response.data) };
  },

  update: async (resource, params) => {
    const response = await apiClient.patch(`${buildResourcePath(resource)}/${params.id}`, params.data);
    return { data: unwrapRecord(response.data) };
  },

  updateMany: async (resource, params) => {
    await apiClient.patch(buildResourcePath(resource), {
      ids: params.ids,
      data: params.data,
    });
    return { data: params.ids };
  },

  delete: async (resource, params) => {
    const response = await apiClient.delete(`${buildResourcePath(resource)}/${params.id}`);
    const data = response.data ? unwrapRecord(response.data) : { id: params.id };
    return { data };
  },

  deleteMany: async (resource, params) => {
    await apiClient.request({
      url: buildResourcePath(resource),
      method: 'DELETE',
      data: { ids: params.ids },
    });
    return { data: params.ids };
  },

  // Expose custom calls for hooks/components
  custom: async ({ url, method = 'get', headers, params, data }) => {
    const result = await apiClient.request({
      url,
      method,
      headers,
      params,
      data,
    });

    return { data: result.data };
  },
};
