import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("api/meal-photo/:key", "routes/api.meal-photo.$key.ts"),
  layout("routes/_layout.tsx", [
    index("routes/_index.tsx"),
    route("meals", "routes/meals.tsx"),
    route("logout", "routes/logout.tsx"),
  ]),
] satisfies RouteConfig;
