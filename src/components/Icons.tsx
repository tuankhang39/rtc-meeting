/**
 * Icon của room — dùng chung bộ icon gấu ở BearIcons.tsx.
 * Giữ nguyên tên export cũ để các component khác không phải đổi import.
 */
import {
  BearBeauty,
  BearCam,
  BearCopy,
  BearEraser,
  BearLeave,
  BearMegaphone,
  BearMic,
  BearPeople,
  BearPlayful,
  BearReact,
  BearRecord,
  BearScreen,
  BearSend,
  BearStar,
  BearSticker,
  BearStopShare,
} from './BearIcons'

type IconProps = {
  size?: number
  className?: string
}

export const IconMic = (p: IconProps) => <BearMic {...p} />
export const IconMicOff = (p: IconProps) => <BearMic {...p} off />
export const IconCam = (p: IconProps) => <BearCam {...p} />
export const IconCamOff = (p: IconProps) => <BearCam {...p} off />
export const IconScreen = BearScreen
export const IconScreenOff = BearStopShare
export const IconLeave = BearLeave
export const IconCopy = BearCopy
export const IconSend = BearSend
export const IconRecord = BearRecord
export const IconBeauty = BearBeauty
export const IconReact = BearReact
export const IconPlayful = BearPlayful
export const IconMegaphone = BearMegaphone
export const IconPeople = BearPeople
export const IconSticker = BearSticker
export const IconEraser = BearEraser
export const IconStar = BearStar
