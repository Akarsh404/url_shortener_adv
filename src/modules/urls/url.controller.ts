import { Request, Response, NextFunction } from 'express';
import { urlService } from './url.service';
import { ListUrlsQuery } from './url.schemas';

export class UrlController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await urlService.createUrl(req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await urlService.getUrl(id, req.userId!);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await urlService.listUrls(req.userId!, req.query as unknown as ListUrlsQuery);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await urlService.updateUrl(id, req.userId!, req.body);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await urlService.deleteUrl(id, req.userId!);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const urlController = new UrlController();
