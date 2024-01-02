import { Context, DAL } from "@medusajs/types"
import { DALUtils, MedusaError } from "@medusajs/utils"
import {
  FilterQuery as MikroFilterQuery,
  FindOptions as MikroOptions,
  LoadStrategy,
} from "@mikro-orm/core"

import { AuthUser } from "@models"
import { RepositoryTypes } from "@types"
import { SqlEntityManager } from "@mikro-orm/postgresql"

export class AuthUserRepository extends DALUtils.MikroOrmBaseRepository {
  protected readonly manager_: SqlEntityManager

  constructor({ manager }: { manager: SqlEntityManager }) {
    // @ts-ignore
    // eslint-disable-next-line prefer-rest-params
    super(...arguments)
    this.manager_ = manager
  }

  async find(
    findOptions: DAL.FindOptions<AuthUser> = { where: {} },
    context: Context = {}
  ): Promise<AuthUser[]> {
    const manager = this.getActiveManager<SqlEntityManager>(context)

    const findOptions_ = { ...findOptions }
    findOptions_.options ??= {}

    Object.assign(findOptions_.options, {
      strategy: LoadStrategy.SELECT_IN,
    })

    return await manager.find(
      AuthUser,
      findOptions_.where as MikroFilterQuery<AuthUser>,
      findOptions_.options as MikroOptions<AuthUser>
    )
  }

  async findAndCount(
    findOptions: DAL.FindOptions<AuthUser> = { where: {} },
    context: Context = {}
  ): Promise<[AuthUser[], number]> {
    const manager = this.getActiveManager<SqlEntityManager>(context)

    const findOptions_ = { ...findOptions }
    findOptions_.options ??= {}

    Object.assign(findOptions_.options, {
      strategy: LoadStrategy.SELECT_IN,
    })

    return await manager.findAndCount(
      AuthUser,
      findOptions_.where as MikroFilterQuery<AuthUser>,
      findOptions_.options as MikroOptions<AuthUser>
    )
  }

  async delete(ids: string[], context: Context = {}): Promise<void> {
    const manager = this.getActiveManager<SqlEntityManager>(context)
    await manager.nativeDelete(AuthUser, { id: { $in: ids } }, {})
  }

  async create(
    data: RepositoryTypes.CreateAuthUserDTO[],
    context: Context = {}
  ): Promise<AuthUser[]> {
    const manager: SqlEntityManager =
      this.getActiveManager<SqlEntityManager>(context)

    const toCreate = data.map((authUser) => {
      const authUserClone = { ...authUser } as any

      authUserClone.provider ??= authUser.provider_id

      return authUserClone
    })

    const authUsers = toCreate.map((authUserData) => {
      return manager.create(AuthUser, authUserData)
    })

    manager.persist(authUsers)

    return authUsers
  }

  async update(
    data: RepositoryTypes.UpdateAuthUserDTO[],
    context: Context = {}
  ): Promise<AuthUser[]> {
    const manager = this.getActiveManager<SqlEntityManager>(context)
    const authUserIds = data.map((authUserData) => authUserData.id)
    const existingAuthUsers = await this.find(
      {
        where: {
          id: {
            $in: authUserIds,
          },
        },
      },
      context
    )

    const existingAuthUsersMap = new Map(
      existingAuthUsers.map<[string, AuthUser]>((authUser) => [
        authUser.id,
        authUser,
      ])
    )

    const authUsers = data.map((authUserData) => {
      const existingAuthUser = existingAuthUsersMap.get(authUserData.id)

      if (!existingAuthUser) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `AuthUser with id "${authUserData.id}" not found`
        )
      }

      return manager.assign(existingAuthUser, authUserData)
    })

    manager.persist(authUsers)

    return authUsers
  }
}
