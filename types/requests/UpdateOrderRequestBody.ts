import { UpdateOrderFields } from '../OrderFields';

export type UpdateOrderRequestBody = {
  orderID: string;
  field: UpdateOrderFields;
  value: string | number;
  isLimitOrder?: boolean;
};
