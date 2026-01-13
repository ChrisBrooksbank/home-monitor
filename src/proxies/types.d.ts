/**
 * Type declarations for proxy server dependencies
 */

// tp-link-tapo-connect types
declare module 'tp-link-tapo-connect' {
    export interface TapoDeviceInfo {
        device_on: boolean;
        nickname: string;
        model: string;
        mac: string;
        rssi: number;
        on_time: number;
        device_id?: string;
        fw_ver?: string;
        hw_ver?: string;
        type?: string;
        overheated?: boolean;
    }

    export interface TapoDevice {
        getDeviceInfo(): Promise<TapoDeviceInfo>;
        turnOn(): Promise<void>;
        turnOff(): Promise<void>;
        setPowerState(on: boolean): Promise<void>;
    }

    export function loginDeviceByIp(
        email: string,
        password: string,
        ip: string
    ): Promise<TapoDevice>;
}

// Shield control module types - use wildcard to match any path
declare module '*/shield-control.js' {
    export interface LaunchResult {
        success: boolean;
        app: string;
        component: string;
        output: string;
    }

    export interface StopResult {
        success: boolean;
        action: string;
        output: string;
    }

    export interface DeviceInfo {
        name: string;
        ip: string;
        connected: boolean;
        uptime: string;
    }

    export const APPS: Record<string, string>;

    export function launchApp(appName: string): Promise<LaunchResult>;
    export function stopApp(): Promise<StopResult>;
    export function getDeviceInfo(): Promise<DeviceInfo>;
    export function sendNotification(
        message: string
    ): Promise<{ success: boolean; message: string }>;
}
