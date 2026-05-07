# Pipeline 多模块配置示例
# 路径: implementation-plan.md 中的 pipeline 配置部分

pipeline:
  enabled: true
  modules:
    - name: user-service
      display_name: 用户服务
      path: services/user
      description: 用户注册、登录、认证
      depends_on: []
      test_command: npm test -- --testPathPattern="user"

    - name: product-service
      display_name: 商品服务
      path: services/product
      description: 商品 CRUD、库存管理
      depends_on: [user-service]
      test_command: npm test -- --testPathPattern="product"

    - name: order-service
      display_name: 订单服务
      path: services/order
      description: 订单创建、状态流转
      depends_on: [user-service, product-service]
      test_command: npm test -- --testPathPattern="order"

    - name: payment-service
      display_name: 支付服务
      path: services/payment
      description: 支付、退款
      depends_on: [order-service]
      test_command: npm test -- --testPathPattern="payment"

# ============================================
# 以下是简化格式（仅包含必要字段）
# ============================================

# 简化格式示例：
# pipeline:
#   modules:
#     - name: 模块A
#       path: src/a
#       depends_on: []
#     - name: 模块B
#       path: src/b
#       depends_on: [模块A]
