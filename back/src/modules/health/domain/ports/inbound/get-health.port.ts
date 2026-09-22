export type HealthResult = Readonly<{
  status: 'ok';
}>;

export interface GetHealthPort {
  execute(): HealthResult;
}
