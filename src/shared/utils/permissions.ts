import { PermissionFlagsBits } from '@discordjs/core';

export { PermissionFlagsBits };

/**
 * Check if a member has all required permissions
 */
export function hasPermissions(
  memberPermissions: bigint,
  requiredPermissions: bigint[]
): boolean {
  for (const permission of requiredPermissions) {
    if ((memberPermissions & permission) !== permission) {
      return false;
    }
  }
  return true;
}

/**
 * Get missing permissions from a set of required permissions
 */
export function getMissingPermissions(
  memberPermissions: bigint,
  requiredPermissions: bigint[]
): bigint[] {
  return requiredPermissions.filter(
    (permission) => (memberPermissions & permission) !== permission
  );
}

/**
 * Convert permission bigint to array of permission names
 */
export function permissionsToArray(permissions: bigint): string[] {
  const permissionNames: string[] = [];
  
  for (const [name, value] of Object.entries(PermissionFlagsBits)) {
    if ((permissions & value) === value) {
      permissionNames.push(name);
    }
  }
  
  return permissionNames;
}
