import { ValidatorRequestReturn } from "../@types";
import {
  type TIntersect,
  type TObject,
  FormatRegistry,
} from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { BadRequest } from "../error";

FormatRegistry.Set("email", (value) => {
  return /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(
    value
  );
});

export const validateRequest = <T extends unknown>(
  schema: TObject | TIntersect
): ValidatorRequestReturn<T> => {
  const C = TypeCompiler.Compile(schema);
  const verify = (data: T): T => {
    const isValid = C.Check(data);
    if (isValid) {
      return data;
    }
    console.log(
      JSON.stringify(
        [...C.Errors(data)].map(({ path, message }) => {
          console.log(path);
          console.log(message);
          return { path, message };
        })
      )
    );
    throw new BadRequest("Invalid specification");
  };

  return { schema, verify };
};
