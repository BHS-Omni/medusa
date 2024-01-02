import { Context, DAL, FindConfig } from "@medusajs/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  ModulesSdkUtils,
  retrieveEntity,
} from "@medusajs/utils"
import { AuthUser } from "@models"
import { AuthUserRepository } from "@repositories"

import { ServiceTypes } from "@types"

type InjectedDependencies = {
  authUserRepository: DAL.RepositoryService
}

export default class AuthUserService<TEntity extends AuthUser = AuthUser> {
  protected readonly authUserRepository_: DAL.RepositoryService

  constructor({ authUserRepository }: InjectedDependencies) {
    this.authUserRepository_ = authUserRepository
  }

  @InjectManager("authUserRepository_")
  async retrieve(
    provider: string,
    config: FindConfig<ServiceTypes.AuthUserDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TEntity> {
    return (await retrieveEntity<AuthUser, ServiceTypes.AuthUserDTO>({
      id: provider,
      entityName: AuthUser.name,
      repository: this.authUserRepository_,
      config,
      sharedContext,
    })) as TEntity
  }

  @InjectManager("authUserRepository_")
  async list(
    filters: ServiceTypes.FilterableAuthProviderProps = {},
    config: FindConfig<ServiceTypes.AuthUserDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TEntity[]> {
    const queryConfig = ModulesSdkUtils.buildQuery<AuthUser>(filters, config)

    return (await this.authUserRepository_.find(
      queryConfig,
      sharedContext
    )) as TEntity[]
  }

  @InjectManager("authUserRepository_")
  async listAndCount(
    filters: ServiceTypes.FilterableAuthUserProps = {},
    config: FindConfig<ServiceTypes.AuthUserDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<[TEntity[], number]> {
    const queryConfig = ModulesSdkUtils.buildQuery<AuthUser>(filters, config)

    return (await this.authUserRepository_.findAndCount(
      queryConfig,
      sharedContext
    )) as [TEntity[], number]
  }

  @InjectTransactionManager("authUserRepository_")
  async create(
    data: ServiceTypes.CreateAuthUserDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TEntity[]> {
    return (await (this.authUserRepository_ as AuthUserRepository).create(
      data,
      sharedContext
    )) as TEntity[]
  }

  @InjectTransactionManager("authUserRepository_")
  async update(
    data: ServiceTypes.UpdateAuthUserDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TEntity[]> {
    return (await (this.authUserRepository_ as AuthUserRepository).update(
      data,
      sharedContext
    )) as TEntity[]
  }

  @InjectTransactionManager("authUserRepository_")
  async delete(
    ids: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.authUserRepository_.delete(ids, sharedContext)
  }
}
