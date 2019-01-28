
# 品葱网站数据格式转换器

> SQL => JSON

## 数据来源

https://github.com/pin-cong/data/blob/master/pink.sql

## 输出格式

```ts
interface Result {
    columns: string[];
    values: (string | number)[][];
}

interface ResultsJson {
    [tableName: string]: Result | null;
}
```

## 许可证

根据 MIT 许可证开源。
