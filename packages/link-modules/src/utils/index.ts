import { MODULE_RESOURCE_TYPE } from "@medusajs/types"

export * from "./compose-link-name"
export * from "./create-connection"
export * from "./soft-deletable"
export * from "./generate-entity"

export function shouldForceTransaction(target: any): boolean {
  return target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
}

export function doNotForceTransaction(): boolean {
  return false
}
