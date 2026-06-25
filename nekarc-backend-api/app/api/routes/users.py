from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
