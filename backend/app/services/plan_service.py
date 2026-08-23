from ..plans import entitlement_for


def get_user_limits(user):
    return entitlement_for(user)["limits"]
