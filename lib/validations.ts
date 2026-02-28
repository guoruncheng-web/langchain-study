// 校验结果类型
interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 校验用户名：3-20位，字母数字下划线
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: "用户名不能为空" };
  }
  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: "用户名长度需要在 3-20 位之间" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: "用户名只能包含字母、数字和下划线" };
  }
  return { valid: true };
}

/**
 * 校验邮箱格式
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: "邮箱不能为空" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "邮箱格式不正确" };
  }
  return { valid: true };
}

/**
 * 校验密码强度：至少8位，包含字母和数字
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: "密码不能为空" };
  }
  if (password.length < 8) {
    return { valid: false, error: "密码长度不能少于 8 位" };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: "密码需要包含字母" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "密码需要包含数字" };
  }
  return { valid: true };
}
