import React from 'react';
import { Tabs, TabsList, TabsTrigger } from 'qcet-eoffice';

export function Default() {
  return (
    <Tabs defaultValue="t1">
      <TabsList>
        <TabsTrigger value="t1">Đang chọn (Active)</TabsTrigger>
        <TabsTrigger value="t2">Chưa chọn</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
