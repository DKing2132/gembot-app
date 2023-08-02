import { OrderResponse } from './OrderResponse';

export type GetAllOrdersResponse = {
  wallet1Orders: OrderResponse[];
  wallet2Orders: OrderResponse[];
  wallet3Orders: OrderResponse[];
};
