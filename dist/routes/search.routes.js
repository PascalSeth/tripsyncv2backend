"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const search_controller_1 = require("../controllers/search.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const searchController = new search_controller_1.SearchController();
// Search endpoint
router.get("/", auth_middleware_1.authMiddleware, searchController.search);
// Get popular searches
router.get("/popular", searchController.getPopularSearches);
exports.default = router;
