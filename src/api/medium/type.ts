export interface FileInter {
    Url:string,
    Name:string,
    Suffix:string,
    Size:number,
    Duration:number,
    info?:{
        artist?: string;
        album?: string;
        lyrics?: string[];
        picture?: string|null;
        quality: string;
        resolution?:string|null;
    }
}
export interface  MusicInfo {
    artist?: string;
    album?: string;
    lyrics?: string[];
    duration: number;
    picture: string|null;
    quality: string;
    resolution?:string|null;
}
