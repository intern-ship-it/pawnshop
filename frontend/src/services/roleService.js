/**
 * Role Service - API calls for roles and permissions
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api'

const roleService = {
  /**
   * Get all roles
   */
  async getRoles() {
    return apiGet('/roles')
  },

  /**
   * Get single role with permissions
   */
  async getRole(id) {
    return apiGet(`/roles/${id}`)
  },

  /**
   * Get role permissions (grouped by module)
   */
  async getRolePermissions(roleId) {
    return apiGet(`/roles/${roleId}/permissions`)
  },

  /**
   * Get all available permissions
   */
  async getAllPermissions() {
    return apiGet('/permissions')
  },

  /**
   * Create new role
   */
  async createRole(data) {
    return apiPost('/roles', data)
  },

  /**
   * Update role
   */
  async updateRole(id, data) {
    return apiPut(`/roles/${id}`, data)
  },

  /**
   * Delete role
   */
  async deleteRole(id) {
    return apiDelete(`/roles/${id}`)
  },

  /**
   * Update role permissions
   * @param {number} roleId 
   * @param {number[]} permissionIds - Array of enabled permission IDs
   */
  async updateRolePermissions(roleId, permissionIds) {
    return apiPut(`/roles/${roleId}/permissions`, {
      permissions: permissionIds
    })
  },
}

export default roleService