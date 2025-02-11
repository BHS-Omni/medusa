import {
  CartTypes,
  Context,
  DAL,
  FilterableLineItemTaxLineProps,
  FindConfig,
  ICartModuleService,
  InternalModuleDeclaration,
  ModuleJoinerConfig,
} from "@medusajs/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  isObject,
  isString,
} from "@medusajs/utils"
import {
  Cart,
  LineItem,
  LineItemAdjustment,
  LineItemTaxLine,
  ShippingMethod,
  ShippingMethodAdjustment,
  ShippingMethodTaxLine,
} from "@models"
import { CreateLineItemDTO, UpdateLineItemDTO } from "@types"
import { joinerConfig } from "../joiner-config"
import * as services from "../services"

type InjectedDependencies = {
  baseRepository: DAL.RepositoryService
  cartService: services.CartService
  addressService: services.AddressService
  lineItemService: services.LineItemService
  shippingMethodAdjustmentService: services.ShippingMethodAdjustmentService
  shippingMethodService: services.ShippingMethodService
  lineItemAdjustmentService: services.LineItemAdjustmentService
  lineItemTaxLineService: services.LineItemTaxLineService
  shippingMethodTaxLineService: services.ShippingMethodTaxLineService
}

export default class CartModuleService implements ICartModuleService {
  protected baseRepository_: DAL.RepositoryService
  protected cartService_: services.CartService
  protected addressService_: services.AddressService
  protected lineItemService_: services.LineItemService
  protected shippingMethodAdjustmentService_: services.ShippingMethodAdjustmentService
  protected shippingMethodService_: services.ShippingMethodService
  protected lineItemAdjustmentService_: services.LineItemAdjustmentService
  protected lineItemTaxLineService_: services.LineItemTaxLineService
  protected shippingMethodTaxLineService_: services.ShippingMethodTaxLineService

  constructor(
    {
      baseRepository,
      cartService,
      addressService,
      lineItemService,
      shippingMethodAdjustmentService,
      shippingMethodService,
      lineItemAdjustmentService,
      shippingMethodTaxLineService,
      lineItemTaxLineService,
    }: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    this.baseRepository_ = baseRepository
    this.cartService_ = cartService
    this.addressService_ = addressService
    this.lineItemService_ = lineItemService
    this.shippingMethodAdjustmentService_ = shippingMethodAdjustmentService
    this.shippingMethodService_ = shippingMethodService
    this.lineItemAdjustmentService_ = lineItemAdjustmentService
    this.shippingMethodTaxLineService_ = shippingMethodTaxLineService
    this.lineItemTaxLineService_ = lineItemTaxLineService
  }

  __joinerConfig(): ModuleJoinerConfig {
    return joinerConfig
  }

  @InjectManager("baseRepository_")
  async retrieve(
    id: string,
    config: FindConfig<CartTypes.CartDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartDTO> {
    const cart = await this.cartService_.retrieve(id, config, sharedContext)

    return await this.baseRepository_.serialize<CartTypes.CartDTO>(cart, {
      populate: true,
    })
  }

  @InjectManager("baseRepository_")
  async list(
    filters: CartTypes.FilterableCartProps = {},
    config: FindConfig<CartTypes.CartDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartDTO[]> {
    const carts = await this.cartService_.list(filters, config, sharedContext)

    return this.baseRepository_.serialize<CartTypes.CartDTO[]>(carts, {
      populate: true,
    })
  }

  @InjectManager("baseRepository_")
  async listAndCount(
    filters: CartTypes.FilterableCartProps = {},
    config: FindConfig<CartTypes.CartDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<[CartTypes.CartDTO[], number]> {
    const [carts, count] = await this.cartService_.listAndCount(
      filters,
      config,
      sharedContext
    )

    return [
      await this.baseRepository_.serialize<CartTypes.CartDTO[]>(carts, {
        populate: true,
      }),
      count,
    ]
  }

  async create(
    data: CartTypes.CreateCartDTO[],
    sharedContext?: Context
  ): Promise<CartTypes.CartDTO[]>

  async create(
    data: CartTypes.CreateCartDTO,
    sharedContext?: Context
  ): Promise<CartTypes.CartDTO>

  @InjectManager("baseRepository_")
  async create(
    data: CartTypes.CreateCartDTO[] | CartTypes.CreateCartDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartDTO[] | CartTypes.CartDTO> {
    const input = Array.isArray(data) ? data : [data]

    const carts = await this.create_(input, sharedContext)

    const result = await this.list(
      { id: carts.map((p) => p!.id) },
      {
        relations: ["shipping_address", "billing_address"],
      },
      sharedContext
    )

    return (Array.isArray(data) ? result : result[0]) as
      | CartTypes.CartDTO
      | CartTypes.CartDTO[]
  }

  @InjectTransactionManager("baseRepository_")
  protected async create_(
    data: CartTypes.CreateCartDTO[],
    @MedusaContext() sharedContext: Context = {}
  ) {
    const lineItemsToCreate: CreateLineItemDTO[] = []
    const createdCarts: Cart[] = []
    for (const { items, ...cart } of data) {
      const [created] = await this.cartService_.create([cart], sharedContext)

      createdCarts.push(created)

      if (items?.length) {
        const cartItems = items.map((item) => {
          return {
            ...item,
            cart_id: created.id,
          }
        })

        lineItemsToCreate.push(...cartItems)
      }
    }

    if (lineItemsToCreate.length) {
      await this.addLineItemsBulk_(lineItemsToCreate, sharedContext)
    }

    return createdCarts
  }

  async update(
    data: CartTypes.UpdateCartDTO[],
    sharedContext?: Context
  ): Promise<CartTypes.CartDTO[]>

  async update(
    data: CartTypes.UpdateCartDTO,
    sharedContext?: Context
  ): Promise<CartTypes.CartDTO>

  @InjectManager("baseRepository_")
  async update(
    data: CartTypes.UpdateCartDTO[] | CartTypes.UpdateCartDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartDTO[] | CartTypes.CartDTO> {
    const input = Array.isArray(data) ? data : [data]
    const carts = await this.update_(input, sharedContext)

    const result = await this.list(
      { id: carts.map((p) => p!.id) },
      {
        relations: ["shipping_address", "billing_address"],
      },
      sharedContext
    )

    return (Array.isArray(data) ? result : result[0]) as
      | CartTypes.CartDTO
      | CartTypes.CartDTO[]
  }

  @InjectTransactionManager("baseRepository_")
  protected async update_(
    data: CartTypes.UpdateCartDTO[],
    @MedusaContext() sharedContext: Context = {}
  ) {
    return await this.cartService_.update(data, sharedContext)
  }

  async delete(ids: string[], sharedContext?: Context): Promise<void>

  async delete(ids: string, sharedContext?: Context): Promise<void>

  @InjectTransactionManager("baseRepository_")
  async delete(
    ids: string[] | string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const cartIds = Array.isArray(ids) ? ids : [ids]
    await this.cartService_.delete(cartIds, sharedContext)
  }

  @InjectManager("baseRepository_")
  async listAddresses(
    filters: CartTypes.FilterableAddressProps = {},
    config: FindConfig<CartTypes.CartAddressDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ) {
    const addresses = await this.addressService_.list(
      filters,
      config,
      sharedContext
    )

    return await this.baseRepository_.serialize<CartTypes.CartAddressDTO[]>(
      addresses,
      {
        populate: true,
      }
    )
  }

  @InjectManager("baseRepository_")
  async retrieveLineItem(
    itemId: string,
    config: FindConfig<CartTypes.CartLineItemDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartLineItemDTO> {
    const item = await this.lineItemService_.retrieve(
      itemId,
      config,
      sharedContext
    )

    return await this.baseRepository_.serialize<CartTypes.CartLineItemDTO>(
      item,
      {
        populate: true,
      }
    )
  }

  @InjectManager("baseRepository_")
  async listLineItems(
    filters: CartTypes.FilterableLineItemProps = {},
    config: FindConfig<CartTypes.CartLineItemDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ) {
    const items = await this.lineItemService_.list(
      filters,
      config,
      sharedContext
    )

    return await this.baseRepository_.serialize<CartTypes.CartLineItemDTO[]>(
      items,
      {
        populate: true,
      }
    )
  }

  @InjectManager("baseRepository_")
  async listShippingMethods(
    filters: CartTypes.FilterableShippingMethodProps = {},
    config: FindConfig<CartTypes.CartShippingMethodDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartShippingMethodDTO[]> {
    const methods = await this.shippingMethodService_.list(
      filters,
      config,
      sharedContext
    )

    return await this.baseRepository_.serialize<
      CartTypes.CartShippingMethodDTO[]
    >(methods, {
      populate: true,
    })
  }

  addLineItems(
    data: CartTypes.CreateLineItemForCartDTO
  ): Promise<CartTypes.CartLineItemDTO[]>
  addLineItems(
    data: CartTypes.CreateLineItemForCartDTO[]
  ): Promise<CartTypes.CartLineItemDTO[]>
  addLineItems(
    cartId: string,
    items: CartTypes.CreateLineItemDTO[],
    sharedContext?: Context
  ): Promise<CartTypes.CartLineItemDTO[]>

  @InjectManager("baseRepository_")
  async addLineItems(
    cartIdOrData:
      | string
      | CartTypes.CreateLineItemForCartDTO[]
      | CartTypes.CreateLineItemForCartDTO,
    data?: CartTypes.CreateLineItemDTO[] | CartTypes.CreateLineItemDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartLineItemDTO[]> {
    let items: LineItem[] = []
    if (isString(cartIdOrData)) {
      items = await this.addLineItems_(
        cartIdOrData,
        data as CartTypes.CreateLineItemDTO[],
        sharedContext
      )
    } else {
      const data = Array.isArray(cartIdOrData) ? cartIdOrData : [cartIdOrData]
      items = await this.addLineItemsBulk_(data, sharedContext)
    }

    return await this.baseRepository_.serialize<CartTypes.CartLineItemDTO[]>(
      items,
      {
        populate: true,
      }
    )
  }

  @InjectTransactionManager("baseRepository_")
  protected async addLineItems_(
    cartId: string,
    items: CartTypes.CreateLineItemDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<LineItem[]> {
    const cart = await this.retrieve(cartId, { select: ["id"] }, sharedContext)

    const toUpdate: CreateLineItemDTO[] = items.map((item) => {
      return {
        ...item,
        cart_id: cart.id,
      }
    })

    return await this.addLineItemsBulk_(toUpdate, sharedContext)
  }

  @InjectTransactionManager("baseRepository_")
  protected async addLineItemsBulk_(
    data: CreateLineItemDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<LineItem[]> {
    return await this.lineItemService_.create(data, sharedContext)
  }

  updateLineItems(
    data: CartTypes.UpdateLineItemWithSelectorDTO[]
  ): Promise<CartTypes.CartLineItemDTO[]>
  updateLineItems(
    selector: Partial<CartTypes.CartLineItemDTO>,
    data: CartTypes.UpdateLineItemDTO,
    sharedContext?: Context
  ): Promise<CartTypes.CartLineItemDTO[]>
  updateLineItems(
    lineItemId: string,
    data: Partial<CartTypes.UpdateLineItemDTO>,
    sharedContext?: Context
  ): Promise<CartTypes.CartLineItemDTO>

  @InjectManager("baseRepository_")
  async updateLineItems(
    lineItemIdOrDataOrSelector:
      | string
      | CartTypes.UpdateLineItemWithSelectorDTO[]
      | Partial<CartTypes.CartLineItemDTO>,
    data?: CartTypes.UpdateLineItemDTO | Partial<CartTypes.UpdateLineItemDTO>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartLineItemDTO[] | CartTypes.CartLineItemDTO> {
    let items: LineItem[] = []
    if (isString(lineItemIdOrDataOrSelector)) {
      const item = await this.updateLineItem_(
        lineItemIdOrDataOrSelector,
        data as Partial<CartTypes.UpdateLineItemDTO>,
        sharedContext
      )

      return await this.baseRepository_.serialize<CartTypes.CartLineItemDTO>(
        item,
        {
          populate: true,
        }
      )
    }

    const toUpdate = Array.isArray(lineItemIdOrDataOrSelector)
      ? lineItemIdOrDataOrSelector
      : [
          {
            selector: lineItemIdOrDataOrSelector,
            data: data,
          } as CartTypes.UpdateLineItemWithSelectorDTO,
        ]

    items = await this.updateLineItemsWithSelector_(toUpdate, sharedContext)

    return await this.baseRepository_.serialize<CartTypes.CartLineItemDTO[]>(
      items,
      {
        populate: true,
      }
    )
  }

  @InjectTransactionManager("baseRepository_")
  protected async updateLineItem_(
    lineItemId: string,
    data: Partial<CartTypes.UpdateLineItemDTO>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<LineItem> {
    const [item] = await this.lineItemService_.update(
      [{ id: lineItemId, ...data }],
      sharedContext
    )

    return item
  }

  @InjectTransactionManager("baseRepository_")
  protected async updateLineItemsWithSelector_(
    updates: CartTypes.UpdateLineItemWithSelectorDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<LineItem[]> {
    let toUpdate: UpdateLineItemDTO[] = []
    for (const { selector, data } of updates) {
      const items = await this.listLineItems({ ...selector }, {}, sharedContext)

      items.forEach((item) => {
        toUpdate.push({
          ...data,
          id: item.id,
        })
      })
    }

    return await this.lineItemService_.update(toUpdate, sharedContext)
  }

  async removeLineItems(
    itemIds: string[],
    sharedContext?: Context
  ): Promise<void>
  async removeLineItems(itemIds: string, sharedContext?: Context): Promise<void>
  async removeLineItems(
    selector: Partial<CartTypes.CartLineItemDTO>,
    sharedContext?: Context
  ): Promise<void>

  @InjectTransactionManager("baseRepository_")
  async removeLineItems(
    itemIdsOrSelector: string | string[] | Partial<CartTypes.CartLineItemDTO>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    let toDelete: string[] = []
    if (isObject(itemIdsOrSelector)) {
      const items = await this.listLineItems(
        { ...itemIdsOrSelector } as Partial<CartTypes.CartLineItemDTO>,
        {},
        sharedContext
      )

      toDelete = items.map((item) => item.id)
    } else {
      toDelete = Array.isArray(itemIdsOrSelector)
        ? itemIdsOrSelector
        : [itemIdsOrSelector]
    }

    await this.lineItemService_.delete(toDelete, sharedContext)
  }

  async createAddresses(
    data: CartTypes.CreateAddressDTO,
    sharedContext?: Context
  ): Promise<CartTypes.CartAddressDTO>
  async createAddresses(
    data: CartTypes.CreateAddressDTO[],
    sharedContext?: Context
  ): Promise<CartTypes.CartAddressDTO[]>

  @InjectManager("baseRepository_")
  async createAddresses(
    data: CartTypes.CreateAddressDTO[] | CartTypes.CreateAddressDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartAddressDTO | CartTypes.CartAddressDTO[]> {
    const input = Array.isArray(data) ? data : [data]
    const addresses = await this.createAddresses_(input, sharedContext)

    const result = await this.listAddresses(
      { id: addresses.map((p) => p.id) },
      {},
      sharedContext
    )

    return (Array.isArray(data) ? result : result[0]) as
      | CartTypes.CartAddressDTO
      | CartTypes.CartAddressDTO[]
  }

  @InjectTransactionManager("baseRepository_")
  protected async createAddresses_(
    data: CartTypes.CreateAddressDTO[],
    @MedusaContext() sharedContext: Context = {}
  ) {
    return await this.addressService_.create(data, sharedContext)
  }

  async updateAddresses(
    data: CartTypes.UpdateAddressDTO,
    sharedContext?: Context
  ): Promise<CartTypes.CartAddressDTO>
  async updateAddresses(
    data: CartTypes.UpdateAddressDTO[],
    sharedContext?: Context
  ): Promise<CartTypes.CartAddressDTO[]>

  @InjectManager("baseRepository_")
  async updateAddresses(
    data: CartTypes.UpdateAddressDTO[] | CartTypes.UpdateAddressDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.CartAddressDTO | CartTypes.CartAddressDTO[]> {
    const input = Array.isArray(data) ? data : [data]
    const addresses = await this.updateAddresses_(input, sharedContext)

    const result = await this.listAddresses(
      { id: addresses.map((p) => p.id) },
      {},
      sharedContext
    )

    return (Array.isArray(data) ? result : result[0]) as
      | CartTypes.CartAddressDTO
      | CartTypes.CartAddressDTO[]
  }

  @InjectTransactionManager("baseRepository_")
  protected async updateAddresses_(
    data: CartTypes.UpdateAddressDTO[],
    @MedusaContext() sharedContext: Context = {}
  ) {
    return await this.addressService_.update(data, sharedContext)
  }

  async deleteAddresses(ids: string[], sharedContext?: Context): Promise<void>
  async deleteAddresses(ids: string, sharedContext?: Context): Promise<void>

  @InjectTransactionManager("baseRepository_")
  async deleteAddresses(
    ids: string[] | string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const addressIds = Array.isArray(ids) ? ids : [ids]
    await this.addressService_.delete(addressIds, sharedContext)
  }

  async addShippingMethods(
    data: CartTypes.CreateShippingMethodDTO
  ): Promise<CartTypes.CartShippingMethodDTO>
  async addShippingMethods(
    data: CartTypes.CreateShippingMethodDTO[]
  ): Promise<CartTypes.CartShippingMethodDTO[]>
  async addShippingMethods(
    cartId: string,
    methods: CartTypes.CreateShippingMethodForSingleCartDTO[],
    sharedContext?: Context
  ): Promise<CartTypes.CartShippingMethodDTO[]>

  @InjectManager("baseRepository_")
  async addShippingMethods(
    cartIdOrData:
      | string
      | CartTypes.CreateShippingMethodDTO[]
      | CartTypes.CreateShippingMethodDTO,
    data?:
      | CartTypes.CreateShippingMethodDTO[]
      | CartTypes.CreateShippingMethodForSingleCartDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    CartTypes.CartShippingMethodDTO[] | CartTypes.CartShippingMethodDTO
  > {
    let methods: ShippingMethod[] = []
    if (isString(cartIdOrData)) {
      methods = await this.addShippingMethods_(
        cartIdOrData,
        data as CartTypes.CreateShippingMethodForSingleCartDTO[],
        sharedContext
      )
    } else {
      const data = Array.isArray(cartIdOrData) ? cartIdOrData : [cartIdOrData]
      methods = await this.addShippingMethodsBulk_(
        data as CartTypes.CreateShippingMethodDTO[],
        sharedContext
      )
    }

    return await this.baseRepository_.serialize<
      CartTypes.CartShippingMethodDTO[]
    >(methods, { populate: true })
  }

  @InjectTransactionManager("baseRepository_")
  protected async addShippingMethods_(
    cartId: string,
    data: CartTypes.CreateShippingMethodForSingleCartDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ShippingMethod[]> {
    const cart = await this.retrieve(cartId, { select: ["id"] }, sharedContext)

    const methods = data.map((method) => {
      return {
        ...method,
        cart_id: cart.id,
      }
    })

    return await this.addShippingMethodsBulk_(methods, sharedContext)
  }

  @InjectTransactionManager("baseRepository_")
  protected async addShippingMethodsBulk_(
    data: CartTypes.CreateShippingMethodDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ShippingMethod[]> {
    return await this.shippingMethodService_.create(data, sharedContext)
  }

  async removeShippingMethods(
    methodIds: string[],
    sharedContext?: Context
  ): Promise<void>
  async removeShippingMethods(
    methodIds: string,
    sharedContext?: Context
  ): Promise<void>
  async removeShippingMethods(
    selector: Partial<CartTypes.CartShippingMethodDTO>,
    sharedContext?: Context
  ): Promise<void>

  @InjectTransactionManager("baseRepository_")
  async removeShippingMethods(
    methodIdsOrSelector:
      | string
      | string[]
      | Partial<CartTypes.CartShippingMethodDTO>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    let toDelete: string[] = []
    if (isObject(methodIdsOrSelector)) {
      const methods = await this.listShippingMethods(
        {
          ...(methodIdsOrSelector as Partial<CartTypes.CartShippingMethodDTO>),
        },
        {},
        sharedContext
      )

      toDelete = methods.map((m) => m.id)
    } else {
      toDelete = Array.isArray(methodIdsOrSelector)
        ? methodIdsOrSelector
        : [methodIdsOrSelector]
    }
    await this.shippingMethodService_.delete(toDelete, sharedContext)
  }

  @InjectManager("baseRepository_")
  async listLineItemAdjustments(
    filters: CartTypes.FilterableLineItemAdjustmentProps = {},
    config: FindConfig<CartTypes.LineItemAdjustmentDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ) {
    const adjustments = await this.lineItemAdjustmentService_.list(
      filters,
      config,
      sharedContext
    )

    return await this.baseRepository_.serialize<
      CartTypes.LineItemAdjustmentDTO[]
    >(adjustments, {
      populate: true,
    })
  }

  async addLineItemAdjustments(
    adjustments: CartTypes.CreateLineItemAdjustmentDTO[]
  ): Promise<CartTypes.LineItemAdjustmentDTO[]>
  async addLineItemAdjustments(
    adjustment: CartTypes.CreateLineItemAdjustmentDTO
  ): Promise<CartTypes.LineItemAdjustmentDTO[]>
  async addLineItemAdjustments(
    cartId: string,
    adjustments: CartTypes.CreateLineItemAdjustmentDTO[],
    sharedContext?: Context
  ): Promise<CartTypes.LineItemAdjustmentDTO[]>

  @InjectTransactionManager("baseRepository_")
  async addLineItemAdjustments(
    cartIdOrData:
      | string
      | CartTypes.CreateLineItemAdjustmentDTO[]
      | CartTypes.CreateLineItemAdjustmentDTO,
    adjustments?: CartTypes.CreateLineItemAdjustmentDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.LineItemAdjustmentDTO[]> {
    let addedAdjustments: LineItemAdjustment[] = []
    if (isString(cartIdOrData)) {
      const cart = await this.retrieve(
        cartIdOrData,
        { select: ["id"], relations: ["items"] },
        sharedContext
      )

      const lineIds = cart.items?.map((item) => item.id)

      for (const adj of adjustments || []) {
        if (!lineIds?.includes(adj.item_id)) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Line item with id ${adj.item_id} does not exist on cart with id ${cartIdOrData}`
          )
        }
      }

      addedAdjustments = await this.lineItemAdjustmentService_.create(
        adjustments as CartTypes.CreateLineItemAdjustmentDTO[],
        sharedContext
      )
    } else {
      const data = Array.isArray(cartIdOrData) ? cartIdOrData : [cartIdOrData]

      addedAdjustments = await this.lineItemAdjustmentService_.create(
        data as CartTypes.CreateLineItemAdjustmentDTO[],
        sharedContext
      )
    }

    return await this.baseRepository_.serialize<
      CartTypes.LineItemAdjustmentDTO[]
    >(addedAdjustments, {
      populate: true,
    })
  }

  @InjectTransactionManager("baseRepository_")
  async setLineItemAdjustments(
    cartId: string,
    adjustments: (
      | CartTypes.CreateLineItemAdjustmentDTO
      | CartTypes.UpdateLineItemAdjustmentDTO
    )[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.LineItemAdjustmentDTO[]> {
    const cart = await this.retrieve(
      cartId,
      { select: ["id"], relations: ["items.adjustments"] },
      sharedContext
    )

    const existingAdjustments = await this.listLineItemAdjustments(
      { item: { cart_id: cart.id } },
      { select: ["id"] },
      sharedContext
    )

    const adjustmentsSet = new Set(
      adjustments
        .map((a) => (a as CartTypes.UpdateLineItemAdjustmentDTO).id)
        .filter(Boolean)
    )

    const toDelete: CartTypes.LineItemAdjustmentDTO[] = []

    // From the existing adjustments, find the ones that are not passed in adjustments
    existingAdjustments.forEach((adj: CartTypes.LineItemAdjustmentDTO) => {
      if (!adjustmentsSet.has(adj.id)) {
        toDelete.push(adj)
      }
    })

    if (toDelete.length) {
      await this.lineItemAdjustmentService_.delete(
        toDelete.map((adj) => adj!.id),
        sharedContext
      )
    }

    let result = await this.lineItemAdjustmentService_.upsert(
      adjustments,
      sharedContext
    )

    return await this.baseRepository_.serialize<
      CartTypes.LineItemAdjustmentDTO[]
    >(result, {
      populate: true,
    })
  }

  async removeLineItemAdjustments(
    adjustmentIds: string[],
    sharedContext?: Context
  ): Promise<void>
  async removeLineItemAdjustments(
    adjustmentId: string,
    sharedContext?: Context
  ): Promise<void>
  async removeLineItemAdjustments(
    selector: Partial<CartTypes.LineItemAdjustmentDTO>,
    sharedContext?: Context
  ): Promise<void>

  async removeLineItemAdjustments(
    adjustmentIdsOrSelector:
      | string
      | string[]
      | Partial<CartTypes.LineItemAdjustmentDTO>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    let ids: string[] = []
    if (isObject(adjustmentIdsOrSelector)) {
      const adjustments = await this.listLineItemAdjustments(
        {
          ...adjustmentIdsOrSelector,
        } as Partial<CartTypes.LineItemAdjustmentDTO>,
        { select: ["id"] },
        sharedContext
      )

      ids = adjustments.map((adj) => adj.id)
    } else {
      ids = Array.isArray(adjustmentIdsOrSelector)
        ? adjustmentIdsOrSelector
        : [adjustmentIdsOrSelector]
    }

    await this.lineItemAdjustmentService_.delete(ids, sharedContext)
  }

  @InjectManager("baseRepository_")
  async listShippingMethodAdjustments(
    filters: CartTypes.FilterableShippingMethodAdjustmentProps = {},
    config: FindConfig<CartTypes.ShippingMethodAdjustmentDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ) {
    const adjustments = await this.shippingMethodAdjustmentService_.list(
      filters,
      config,
      sharedContext
    )

    return await this.baseRepository_.serialize<
      CartTypes.ShippingMethodAdjustmentDTO[]
    >(adjustments, {
      populate: true,
    })
  }

  @InjectTransactionManager("baseRepository_")
  async setShippingMethodAdjustments(
    cartId: string,
    adjustments: (
      | CartTypes.CreateShippingMethodAdjustmentDTO
      | CartTypes.UpdateShippingMethodAdjustmentDTO
    )[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.ShippingMethodAdjustmentDTO[]> {
    const cart = await this.retrieve(
      cartId,
      { select: ["id"], relations: ["shipping_methods.adjustments"] },
      sharedContext
    )

    const existingAdjustments = await this.listShippingMethodAdjustments(
      { shipping_method: { cart_id: cart.id } },
      { select: ["id"] },
      sharedContext
    )

    const adjustmentsSet = new Set(
      adjustments
        .map((a) => (a as CartTypes.UpdateShippingMethodAdjustmentDTO)?.id)
        .filter(Boolean)
    )

    const toDelete: CartTypes.ShippingMethodAdjustmentDTO[] = []

    // From the existing adjustments, find the ones that are not passed in adjustments
    existingAdjustments.forEach(
      (adj: CartTypes.ShippingMethodAdjustmentDTO) => {
        if (!adjustmentsSet.has(adj.id)) {
          toDelete.push(adj)
        }
      }
    )

    if (toDelete.length) {
      await this.shippingMethodAdjustmentService_.delete(
        toDelete.map((adj) => adj!.id),
        sharedContext
      )
    }

    const result = await this.shippingMethodAdjustmentService_.upsert(
      adjustments,
      sharedContext
    )

    return await this.baseRepository_.serialize<
      CartTypes.ShippingMethodAdjustmentDTO[]
    >(result, {
      populate: true,
    })
  }

  async addShippingMethodAdjustments(
    adjustments: CartTypes.CreateShippingMethodAdjustmentDTO[]
  ): Promise<CartTypes.ShippingMethodAdjustmentDTO[]>
  async addShippingMethodAdjustments(
    adjustment: CartTypes.CreateShippingMethodAdjustmentDTO
  ): Promise<CartTypes.ShippingMethodAdjustmentDTO>
  async addShippingMethodAdjustments(
    cartId: string,
    adjustments: CartTypes.CreateShippingMethodAdjustmentDTO[],
    sharedContext?: Context
  ): Promise<CartTypes.ShippingMethodAdjustmentDTO[]>

  @InjectTransactionManager("baseRepository_")
  async addShippingMethodAdjustments(
    cartIdOrData:
      | string
      | CartTypes.CreateShippingMethodAdjustmentDTO[]
      | CartTypes.CreateShippingMethodAdjustmentDTO,
    adjustments?: CartTypes.CreateShippingMethodAdjustmentDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    | CartTypes.ShippingMethodAdjustmentDTO[]
    | CartTypes.ShippingMethodAdjustmentDTO
  > {
    let addedAdjustments: ShippingMethodAdjustment[] = []
    if (isString(cartIdOrData)) {
      const cart = await this.retrieve(
        cartIdOrData,
        { select: ["id"], relations: ["shipping_methods"] },
        sharedContext
      )

      const methodIds = cart.shipping_methods?.map((method) => method.id)

      for (const adj of adjustments || []) {
        if (!methodIds?.includes(adj.shipping_method_id)) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Shipping method with id ${adj.shipping_method_id} does not exist on cart with id ${cartIdOrData}`
          )
        }
      }

      addedAdjustments = await this.shippingMethodAdjustmentService_.create(
        adjustments as CartTypes.CreateShippingMethodAdjustmentDTO[],
        sharedContext
      )
    } else {
      const data = Array.isArray(cartIdOrData) ? cartIdOrData : [cartIdOrData]

      addedAdjustments = await this.shippingMethodAdjustmentService_.create(
        data as CartTypes.CreateShippingMethodAdjustmentDTO[],
        sharedContext
      )
    }

    if (isObject(cartIdOrData)) {
      return await this.baseRepository_.serialize<CartTypes.ShippingMethodAdjustmentDTO>(
        addedAdjustments[0],
        {
          populate: true,
        }
      )
    }

    return await this.baseRepository_.serialize<
      CartTypes.ShippingMethodAdjustmentDTO[]
    >(addedAdjustments, {
      populate: true,
    })
  }

  async removeShippingMethodAdjustments(
    adjustmentIds: string[],
    sharedContext?: Context
  ): Promise<void>
  async removeShippingMethodAdjustments(
    adjustmentId: string,
    sharedContext?: Context
  ): Promise<void>
  async removeShippingMethodAdjustments(
    selector: Partial<CartTypes.ShippingMethodAdjustmentDTO>,
    sharedContext?: Context
  ): Promise<void>

  async removeShippingMethodAdjustments(
    adjustmentIdsOrSelector:
      | string
      | string[]
      | Partial<CartTypes.ShippingMethodAdjustmentDTO>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    let ids: string[] = []
    if (isObject(adjustmentIdsOrSelector)) {
      const adjustments = await this.listShippingMethodAdjustments(
        {
          ...adjustmentIdsOrSelector,
        } as Partial<CartTypes.ShippingMethodAdjustmentDTO>,
        { select: ["id"] },
        sharedContext
      )

      ids = adjustments.map((adj) => adj.id)
    } else {
      ids = Array.isArray(adjustmentIdsOrSelector)
        ? adjustmentIdsOrSelector
        : [adjustmentIdsOrSelector]
    }

    await this.shippingMethodAdjustmentService_.delete(ids, sharedContext)
  }

  @InjectManager("baseRepository_")
  async listLineItemTaxLines(
    filters: CartTypes.FilterableLineItemTaxLineProps = {},
    config: FindConfig<CartTypes.LineItemTaxLineDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ) {
    const taxLines = await this.lineItemTaxLineService_.list(
      filters,
      config,
      sharedContext
    )

    return await this.baseRepository_.serialize<CartTypes.LineItemTaxLineDTO[]>(
      taxLines,
      {
        populate: true,
      }
    )
  }

  addLineItemTaxLines(
    taxLines: CartTypes.CreateLineItemTaxLineDTO[]
  ): Promise<CartTypes.LineItemTaxLineDTO[]>
  addLineItemTaxLines(
    taxLine: CartTypes.CreateLineItemTaxLineDTO
  ): Promise<CartTypes.LineItemTaxLineDTO>
  addLineItemTaxLines(
    cartId: string,
    taxLines:
      | CartTypes.CreateLineItemTaxLineDTO[]
      | CartTypes.CreateShippingMethodTaxLineDTO,
    sharedContext?: Context
  ): Promise<CartTypes.LineItemTaxLineDTO[]>

  @InjectTransactionManager("baseRepository_")
  async addLineItemTaxLines(
    cartIdOrData:
      | string
      | CartTypes.CreateLineItemTaxLineDTO[]
      | CartTypes.CreateLineItemTaxLineDTO,
    taxLines?:
      | CartTypes.CreateLineItemTaxLineDTO[]
      | CartTypes.CreateLineItemTaxLineDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.LineItemTaxLineDTO[] | CartTypes.LineItemTaxLineDTO> {
    let addedTaxLines: LineItemTaxLine[] = []
    if (isString(cartIdOrData)) {
      // existence check
      await this.retrieve(cartIdOrData, { select: ["id"] }, sharedContext)

      const lines = Array.isArray(taxLines) ? taxLines : [taxLines]

      addedTaxLines = await this.lineItemTaxLineService_.create(
        lines as CartTypes.CreateLineItemTaxLineDTO[],
        sharedContext
      )
    } else {
      const data = Array.isArray(cartIdOrData) ? cartIdOrData : [cartIdOrData]

      addedTaxLines = await this.lineItemTaxLineService_.create(
        data as CartTypes.CreateLineItemTaxLineDTO[],
        sharedContext
      )
    }

    const serialized = await this.baseRepository_.serialize<
      CartTypes.LineItemTaxLineDTO[]
    >(addedTaxLines, {
      populate: true,
    })

    if (isObject(cartIdOrData)) {
      return serialized[0]
    }

    return serialized
  }

  @InjectTransactionManager("baseRepository_")
  async setLineItemTaxLines(
    cartId: string,
    taxLines: (
      | CartTypes.CreateLineItemTaxLineDTO
      | CartTypes.UpdateLineItemTaxLineDTO
    )[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.LineItemTaxLineDTO[]> {
    const cart = await this.retrieve(
      cartId,
      { select: ["id"], relations: ["items.tax_lines"] },
      sharedContext
    )

    const existingTaxLines = await this.listLineItemTaxLines(
      { item: { cart_id: cart.id } },
      { select: ["id"] },
      sharedContext
    )

    const taxLinesSet = new Set(
      taxLines
        .map((taxLine) => (taxLine as CartTypes.UpdateLineItemTaxLineDTO)?.id)
        .filter(Boolean)
    )

    const toDelete: CartTypes.LineItemTaxLineDTO[] = []

    // From the existing tax lines, find the ones that are not passed in taxLines
    existingTaxLines.forEach((taxLine: CartTypes.LineItemTaxLineDTO) => {
      if (!taxLinesSet.has(taxLine.id)) {
        toDelete.push(taxLine)
      }
    })

    await this.lineItemTaxLineService_.delete(
      toDelete.map((taxLine) => taxLine!.id),
      sharedContext
    )

    const result = await this.lineItemTaxLineService_.upsert(
      taxLines,
      sharedContext
    )

    return await this.baseRepository_.serialize<CartTypes.LineItemTaxLineDTO[]>(
      result,
      {
        populate: true,
      }
    )
  }

  removeLineItemTaxLines(
    taxLineIds: string[],
    sharedContext?: Context
  ): Promise<void>
  removeLineItemTaxLines(
    taxLineIds: string,
    sharedContext?: Context
  ): Promise<void>
  removeLineItemTaxLines(
    selector: FilterableLineItemTaxLineProps,
    sharedContext?: Context
  ): Promise<void>

  async removeLineItemTaxLines(
    taxLineIdsOrSelector:
      | string
      | string[]
      | CartTypes.FilterableShippingMethodTaxLineProps,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    let ids: string[] = []
    if (isObject(taxLineIdsOrSelector)) {
      const taxLines = await this.listLineItemTaxLines(
        {
          ...(taxLineIdsOrSelector as CartTypes.FilterableLineItemTaxLineProps),
        },
        { select: ["id"] },
        sharedContext
      )

      ids = taxLines.map((taxLine) => taxLine.id)
    } else {
      ids = Array.isArray(taxLineIdsOrSelector)
        ? taxLineIdsOrSelector
        : [taxLineIdsOrSelector]
    }

    await this.lineItemTaxLineService_.delete(ids, sharedContext)
  }

  @InjectManager("baseRepository_")
  async listShippingMethodTaxLines(
    filters: CartTypes.FilterableShippingMethodTaxLineProps = {},
    config: FindConfig<CartTypes.ShippingMethodTaxLineDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ) {
    const taxLines = await this.shippingMethodTaxLineService_.list(
      filters,
      config,
      sharedContext
    )

    return await this.baseRepository_.serialize<
      CartTypes.ShippingMethodTaxLineDTO[]
    >(taxLines, {
      populate: true,
    })
  }

  addShippingMethodTaxLines(
    taxLines: CartTypes.CreateShippingMethodTaxLineDTO[]
  ): Promise<CartTypes.ShippingMethodTaxLineDTO[]>
  addShippingMethodTaxLines(
    taxLine: CartTypes.CreateShippingMethodTaxLineDTO
  ): Promise<CartTypes.ShippingMethodTaxLineDTO>
  addShippingMethodTaxLines(
    cartId: string,
    taxLines:
      | CartTypes.CreateShippingMethodTaxLineDTO[]
      | CartTypes.CreateShippingMethodTaxLineDTO,
    sharedContext?: Context
  ): Promise<CartTypes.ShippingMethodTaxLineDTO[]>

  @InjectTransactionManager("baseRepository_")
  async addShippingMethodTaxLines(
    cartIdOrData:
      | string
      | CartTypes.CreateShippingMethodTaxLineDTO[]
      | CartTypes.CreateShippingMethodTaxLineDTO,
    taxLines?:
      | CartTypes.CreateShippingMethodTaxLineDTO[]
      | CartTypes.CreateShippingMethodTaxLineDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    CartTypes.ShippingMethodTaxLineDTO[] | CartTypes.ShippingMethodTaxLineDTO
  > {
    let addedTaxLines: ShippingMethodTaxLine[] = []
    if (isString(cartIdOrData)) {
      // existence check
      await this.retrieve(cartIdOrData, { select: ["id"] }, sharedContext)

      const lines = Array.isArray(taxLines) ? taxLines : [taxLines]

      addedTaxLines = await this.shippingMethodTaxLineService_.create(
        lines as CartTypes.CreateShippingMethodTaxLineDTO[],
        sharedContext
      )
    } else {
      addedTaxLines = await this.shippingMethodTaxLineService_.create(
        taxLines as CartTypes.CreateShippingMethodTaxLineDTO[],
        sharedContext
      )
    }

    const serialized =
      await this.baseRepository_.serialize<CartTypes.ShippingMethodTaxLineDTO>(
        addedTaxLines[0],
        {
          populate: true,
        }
      )

    if (isObject(cartIdOrData)) {
      return serialized[0]
    }

    return serialized
  }

  @InjectTransactionManager("baseRepository_")
  async setShippingMethodTaxLines(
    cartId: string,
    taxLines: (
      | CartTypes.CreateShippingMethodTaxLineDTO
      | CartTypes.UpdateShippingMethodTaxLineDTO
    )[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CartTypes.ShippingMethodTaxLineDTO[]> {
    const cart = await this.retrieve(
      cartId,
      { select: ["id"], relations: ["shipping_methods.tax_lines"] },
      sharedContext
    )

    const existingTaxLines = await this.listShippingMethodTaxLines(
      { shipping_method: { cart_id: cart.id } },
      { select: ["id"] },
      sharedContext
    )

    const taxLinesSet = new Set(
      taxLines
        .map(
          (taxLine) => (taxLine as CartTypes.UpdateShippingMethodTaxLineDTO)?.id
        )
        .filter(Boolean)
    )

    const toDelete: CartTypes.ShippingMethodTaxLineDTO[] = []

    // From the existing tax lines, find the ones that are not passed in taxLines
    existingTaxLines.forEach((taxLine: CartTypes.ShippingMethodTaxLineDTO) => {
      if (!taxLinesSet.has(taxLine.id)) {
        toDelete.push(taxLine)
      }
    })

    if (toDelete.length) {
      await this.shippingMethodTaxLineService_.delete(
        toDelete.map((taxLine) => taxLine!.id),
        sharedContext
      )
    }

    const result = await this.shippingMethodTaxLineService_.upsert(
      taxLines,
      sharedContext
    )

    return await this.baseRepository_.serialize<
      CartTypes.ShippingMethodTaxLineDTO[]
    >(result, {
      populate: true,
    })
  }

  removeShippingMethodTaxLines(
    taxLineIds: string[],
    sharedContext?: Context
  ): Promise<void>
  removeShippingMethodTaxLines(
    taxLineIds: string,
    sharedContext?: Context
  ): Promise<void>
  removeShippingMethodTaxLines(
    selector: Partial<CartTypes.ShippingMethodTaxLineDTO>,
    sharedContext?: Context
  ): Promise<void>

  async removeShippingMethodTaxLines(
    taxLineIdsOrSelector:
      | string
      | string[]
      | CartTypes.FilterableShippingMethodTaxLineProps,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    let ids: string[] = []
    if (isObject(taxLineIdsOrSelector)) {
      const taxLines = await this.listShippingMethodTaxLines(
        {
          ...(taxLineIdsOrSelector as CartTypes.FilterableShippingMethodTaxLineProps),
        },
        { select: ["id"] },
        sharedContext
      )

      ids = taxLines.map((taxLine) => taxLine.id)
    } else {
      ids = Array.isArray(taxLineIdsOrSelector)
        ? taxLineIdsOrSelector
        : [taxLineIdsOrSelector]
    }

    await this.shippingMethodTaxLineService_.delete(ids, sharedContext)
  }
}
