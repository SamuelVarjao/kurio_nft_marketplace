/**
 * Schemas de validação compartilhados entre formulários (cliente) e handlers
 * MSW (servidor simulado). O servidor revalida tudo — o cliente nunca é a
 * única barreira.
 */
import { z } from 'zod'

const required = (label: string) => `${label} é obrigatório`

export const emailSchema = z
  .string()
  .trim()
  .min(1, required('E-mail'))
  .email('Informe um e-mail válido')

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres')
  .max(24, 'Use no máximo 24 caracteres')
  .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, "_" ou "."')

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra')
  .regex(/\d/, 'Inclua pelo menos um número')

export const ensNameSchema = z
  .string()
  .trim()
  .min(1, required('Nome ENS'))
  .max(40, 'Use no máximo 40 caracteres')
  .regex(/^[a-z0-9-]+$/, 'Use letras minúsculas, números ou "-" (sem o .eth)')

export const addressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço deve começar com 0x e ter 40 caracteres hexadecimais')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, required('Senha')),
})

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })

export const registerRequestSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
})

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Use pelo menos 2 caracteres').max(40, 'Use no máximo 40 caracteres'),
  username: usernameSchema,
  email: emailSchema,
  ensName: ensNameSchema,
  walletNickname: z.string().trim().min(2, 'Use pelo menos 2 caracteres').max(30, 'Use no máximo 30 caracteres'),
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })

export const passwordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

export const walletSchema = z.object({
  displayName: z.string().trim().min(2, 'Use pelo menos 2 caracteres').max(40),
  nickname: z.string().trim().min(2, 'Use pelo menos 2 caracteres').max(30),
  network: z.enum(['ethereum', 'polygon', 'solana'], { message: 'Selecione uma rede' }),
  profileName: z.string().trim().min(2, 'Use pelo menos 2 caracteres').max(40),
  address: addressSchema,
  ensOrSecondary: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  provider: z.enum(['metamask', 'walletconnect', 'coinbase'], { message: 'Selecione uma carteira' }),
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,12}$/i, 'Código deve ter de 4 a 12 letras ou números'),
  email: emailSchema,
  ensName: ensNameSchema,
  ensTld: z.literal('.eth'),
})

export type WalletFormValues = z.input<typeof walletSchema>

export const buyerSchema = z.object({
  displayName: z.string().trim().min(2, 'Use pelo menos 2 caracteres').max(40),
  username: usernameSchema,
  profileName: z.string().trim().min(2, 'Use pelo menos 2 caracteres').max(40),
  email: emailSchema,
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,12}$/i, 'Código deve ter de 4 a 12 letras ou números'),
  ensName: ensNameSchema,
  ensOrSecondary: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  note: z
    .string()
    .trim()
    .max(280, 'Use no máximo 280 caracteres')
    .transform((v) => (v === '' ? null : v))
    .nullable(),
})

export type BuyerFormValues = z.input<typeof buyerSchema>

/** Converte issues do zod no formato `fields` do ApiErrorBody. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !fields[key]) fields[key] = issue.message
  }
  return fields
}
